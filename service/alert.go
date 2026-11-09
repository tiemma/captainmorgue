package main

import (
	"cmp"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
)

const alertWindow = 10 * time.Minute

var serviceKeys = []string{"service.name", "service", "impacted_service"}

type dash0Attr struct {
	Key   string `json:"key"`
	Value struct {
		StringValue string `json:"stringValue"`
	} `json:"value"`
}

type alertBody struct {
	Service  string `json:"service"`
	Summary  string `json:"summary"`
	Severity string `json:"severity"`
	Source   string `json:"source"`
	Type     string `json:"type"`
	Data     struct {
		Issue struct {
			Summary     string      `json:"summary"`
			Status      string      `json:"status"`
			Labels      []dash0Attr `json:"labels"`
			Annotations []dash0Attr `json:"annotations"`
			Checkrules  []struct {
				Name string `json:"name"`
			} `json:"checkrules"`
		} `json:"issue"`
	} `json:"data"`
}

type alert struct {
	service, summary, severity, source string
	resolved                           bool
}

func (b alertBody) alert() (alert, bool) {
	if b.Type == "" {
		sev := strings.ToLower(b.Severity)
		return alert{b.Service, b.Summary, b.Severity, cmp.Or(b.Source, "alert"), sev == "resolved" || sev == "ok"}, true
	}
	if b.Type == "alert.superseded" {
		return alert{}, false
	}
	is := b.Data.Issue
	a := alert{summary: is.Summary, severity: is.Status, source: "dash0", resolved: b.Type == "alert.resolved" || b.Type == "alert.closed"}
	if a.summary == "" && len(is.Checkrules) > 0 {
		a.summary = is.Checkrules[0].Name
	}
	attrs := append(is.Labels, is.Annotations...)
	for _, key := range serviceKeys {
		if i := slices.IndexFunc(attrs, func(kv dash0Attr) bool { return kv.Key == key }); i >= 0 {
			a.service = attrs[i].Value.StringValue
			break
		}
	}
	return a, true
}

func (r Roster) owner(service string) (Team, bool) {
	for _, t := range r.Teams {
		if slices.Contains(t.Owns, service) {
			return t, true
		}
	}
	return Team{}, false
}

func (inc *Incident) handleAlert(w http.ResponseWriter, r *http.Request) {
	var body alertBody
	if !decodeBody(w, r, &body) {
		return
	}
	a, ok := body.alert()
	if !ok {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	if a.service == "" || a.summary == "" {
		http.Error(w, "alert needs a service and a summary", http.StatusBadRequest)
		return
	}
	inc.mu.Lock()
	evs := inc.alertEvents(a, time.Now().UTC())
	inc.mu.Unlock()
	for _, ev := range evs {
		inc.append(ev)
	}
	w.WriteHeader(http.StatusAccepted)
}

func (inc *Incident) alertEvents(a alert, now time.Time) []Event {
	c := &inc.coord
	everyone := c.joinedNames()
	team, owned := inc.roster.owner(a.service)
	last, alerting := inc.lastAlert(a.service)
	open := inc.isOpen()
	if !open && !a.resolved {
		if status, _ := inc.lifecycleStatus(); status == "closed" {
			inc.reopen()
		}
	}
	if a.resolved {
		if !alerting {
			return nil
		}
		return []Event{{
			Actor: a.source, Team: team.ID, Type: "recovered", To: everyone, Service: a.service,
			Text:   fmt.Sprintf("%s recovered: %s", a.service, a.summary),
			Why:    "Everyone in " + inc.id + " hears when an alerting service recovers.",
			Signal: &Signal{Value: "recovered", Status: "ok"},
		}}
	}
	signal := &Signal{Value: a.summary, Status: "critical"}
	var evs []Event
	if !open {
		inc.title = a.service + ": " + a.summary
		evs = append(evs, Event{Actor: a.source, Type: "open", Text: "Opened " + inc.id + ": " + inc.title})
	}
	if alerting && now.Sub(last.TS) < alertWindow {
		return append(evs, Event{Actor: a.source, Team: team.ID, Type: "alert", Service: a.service, Signal: signal,
			Text: fmt.Sprintf("%s still alerting: %s", a.service, a.summary)})
	}
	if !owned {
		return append(evs, Event{Actor: a.source, Type: "alert", To: everyone, Service: a.service, Signal: signal,
			Text: fmt.Sprintf("%s alert: %s. No team in the roster owns it.", a.service, a.summary),
			Why:  "Everyone in " + inc.id + " sees alerts."})
	}

	paged, why := inc.pageTargets(team, now)
	who := "nobody from " + team.Name + " has joined to be"
	switch len(paged) {
	case 0:
	case 1:
		who = paged[0] + " is"
	default:
		who = strings.Join(paged, ", ") + " are"
	}
	text := fmt.Sprintf("%s alert: %s. %s owns it; %s paged.", a.service, a.summary, team.Name, who)
	evs = append(evs, Event{
		Actor: a.source, Team: team.ID, Type: "alert", Service: a.service, Signal: signal, Text: text,
		To:  slices.DeleteFunc(everyone, func(n string) bool { return slices.Contains(paged, n) }),
		Why: fmt.Sprintf("Severity %s from %s; everyone in %s sees alerts.", cmp.Or(a.severity, "unknown"), a.source, inc.id),
	})
	if len(paged) > 0 {
		evs = append(evs, Event{Actor: a.source, Team: team.ID, Type: "page", Service: a.service, To: paged, Why: why,
			Text: fmt.Sprintf("%s alert: %s. Start triage on %s: take it, hand it off, or let your agent investigate.", a.service, a.summary, a.service)})
	}
	return evs
}

func (inc *Incident) pageTargets(team Team, now time.Time) ([]string, string) {
	c := &inc.coord
	if m := c.team(team.ID).manager; m != "" && c.status(m, now) != "offline" {
		return []string{m}, fmt.Sprintf("You manage %s, which owns this service.", team.Name)
	}
	return c.joinedIn(team.ID), fmt.Sprintf("%s owns this service and has no manager online.", team.Name)
}

func (inc *Incident) isOpen() bool {
	for i := len(inc.events) - 1; i >= 0; i-- {
		switch inc.events[i].Type {
		case "open":
			return true
		case "close":
			return false
		}
	}
	return false
}

func (inc *Incident) lastAlert(service string) (Event, bool) {
	for i := len(inc.events) - 1; i >= 0; i-- {
		ev := inc.events[i]
		if ev.Type == "close" || (ev.Type == "recovered" && ev.Service == service) {
			return Event{}, false
		}
		if ev.Service == service && (ev.Type == "page" || (ev.Type == "alert" && len(ev.To) > 0)) {
			return ev, true
		}
	}
	return Event{}, false
}
