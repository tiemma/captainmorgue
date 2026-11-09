package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type IncidentSummary struct {
	ID       string     `json:"id"`
	Title    string     `json:"title"`
	Status   string     `json:"status"`
	Severity string     `json:"severity"`
	Opened   *time.Time `json:"opened"`
	Closed   *time.Time `json:"closed"`
}

type TeamState struct {
	Team
	Term     int  `json:"term"`
	PulledIn bool `json:"pulled_in"`
}

type Part struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Owner      string     `json:"owner"`
	Progress   int        `json:"progress"`
	Status     string     `json:"status"`
	ResolvedAt *time.Time `json:"resolved_at"`
	Note       string     `json:"note"`
}

type Relay struct {
	From string   `json:"from"`
	To   []string `json:"to"`
	Text string   `json:"text"`
	Why  string   `json:"why"`
}

type Signal struct {
	Value  string `json:"value"`
	Status string `json:"status"`
}

type State struct {
	Incident  IncidentSummary   `json:"incident"`
	Teams     []TeamState       `json:"teams"`
	People    map[string]Person `json:"people"`
	Parts     []Part            `json:"parts"`
	Relay     *Relay            `json:"relay"`
	Conflict  *Event            `json:"conflict"`
	Signals   map[string]Signal `json:"signals"`
	PastMatch *PastMatch        `json:"past_match"`
	Claims    []Claim           `json:"claims"`
	Commander string            `json:"commander"`
	PRs       []PR              `json:"prs"`
	Repos     map[string]Repo   `json:"repos"`

	Deliveries map[int]map[string]string `json:"deliveries"`
}

func (inc *Incident) state() State {
	now := time.Now().UTC()
	status, severity := inc.lifecycleStatus()
	s := State{
		Incident:  IncidentSummary{ID: inc.id, Title: inc.title, Status: status, Severity: severity},
		People:    inc.people(now),
		Parts:     []Part{},
		Signals:   map[string]Signal{},
		PastMatch: inc.pastMatch,
		Claims:    inc.activeClaims(now),
		Commander: inc.coord.commander,
		PRs:       inc.prs(),
		Repos:     inc.roster.Services,

		Deliveries: inc.coord.deliveries,
	}
	if len(inc.events) > 0 {
		s.Incident.Opened = &inc.events[0].TS
	}
	inIncident := inc.teamsInIncident()
	for _, t := range inc.liveRoster().Teams {
		s.Teams = append(s.Teams, TeamState{Team: t, Term: inc.coord.team(t.ID).term, PulledIn: inIncident[t.ID]})
	}
	for i := range inc.events {
		ev := &inc.events[i]
		if ev.Signal != nil {
			s.Signals[ev.Service] = *ev.Signal
		}
		switch ev.Type {
		case "open":
			s.Incident.Opened, s.Incident.Closed = &ev.TS, nil
		case "relay", "broadcast":
			s.Relay = &Relay{From: ev.Actor, To: ev.To, Text: ev.Text, Why: ev.Why}
		case "conflict":
			s.Conflict = ev
		case "close":
			s.Incident.Closed = &ev.TS
		}
	}
	return s
}

type RecordPart struct {
	Name string `json:"name"`
	How  string `json:"how"`
}

type Improvement struct {
	Text  string `json:"text"`
	Owner string `json:"owner"`
	Link  string `json:"link"`
	Due   string `json:"due"`
}

type Record struct {
	ID                  string        `json:"id"`
	Title               string        `json:"title"`
	Status              string        `json:"status"`
	Severity            string        `json:"severity"`
	WrittenBy           string        `json:"written_by"`
	Opened              *time.Time    `json:"opened"`
	Resolved            *time.Time    `json:"resolved"`
	Duration            string        `json:"duration"`
	Window              Window        `json:"window"`
	People              int           `json:"people"`
	Teams               int           `json:"teams"`
	Conflicts           int           `json:"conflicts"`
	Summary             string        `json:"summary"`
	RootCause           string        `json:"root_cause"`
	ContributingFactors []string      `json:"contributing_factors"`
	Timeline            []Moment      `json:"timeline"`
	WentWell            []string      `json:"went_well"`
	WentBadly           []string      `json:"went_badly"`
	Errors              []Moment      `json:"errors"`
	Remediation         []PR          `json:"remediation"`
	ActionItems         []Improvement `json:"action_items"`
	Parts               []RecordPart  `json:"parts"`
	PastMatch           *PastMatch    `json:"past_match"`
	Events              []Event       `json:"events"`
}

func (inc *Incident) record() Record {
	status, severity := inc.lifecycleStatus()
	win := window(inc.events)
	written, by := fallbackRecord(inc.title, inc.events), captainMorgue
	if inc.written != nil && status == "closed" {
		written, by = *inc.written, inc.writtenBy
	}
	rec := Record{
		ID: inc.id, Title: inc.title, Status: status, Severity: severity, WrittenBy: by,
		Opened: win.Opened, Resolved: win.Resolved, Duration: win.Duration, Window: win,
		Summary: written.Summary, RootCause: written.RootCause, ContributingFactors: written.ContributingFactors,
		Timeline:    moments(inc.events, func(ev Event) bool { return keyEvents[ev.Type] }),
		WentWell:    written.WentWell,
		WentBadly:   written.WentBadly,
		Errors:      incidentErrors(inc.events),
		Remediation: inc.prs(),
		ActionItems: explicitActionItems(inc.events, severity),
		Parts:       written.Parts, PastMatch: inc.pastMatch, Events: inc.events,
	}
	for _, a := range written.Improvements {
		if a.Due == "" {
			a.Due = dueBySeverity[severity]
		}
		rec.ActionItems = append(rec.ActionItems, a)
	}
	people := map[string]bool{}
	for _, ev := range inc.events {
		if inc.teamOf(ev.Actor) != "" {
			people[ev.Actor] = true
		}
		if ev.Type == "conflict" {
			rec.Conflicts++
		}
	}
	rec.People = len(people)
	rec.Teams = len(inc.teamsInIncident())
	return rec
}

func (inc *Incident) handleRecord(w http.ResponseWriter, r *http.Request) {
	id, asMarkdown := strings.CutSuffix(r.PathValue("id"), ".md")
	if id != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	inc.mu.Lock()
	rec := inc.record()
	inc.mu.Unlock()
	if asMarkdown {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		if _, err := io.WriteString(w, rec.markdown()); err != nil {
			slog.Debug("write record markdown", "err", err)
		}
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(rec); err != nil {
		slog.Debug("write record", "err", err)
	}
}

func (inc *Incident) writeRecord() {
	inc.mu.Lock()
	events := append([]Event(nil), inc.events...)
	roster := inc.liveRoster()
	title := inc.title
	inc.mu.Unlock()

	written, by := fallbackRecord(title, events), captainMorgue
	if inc.brain != nil {
		ctx, cancel := context.WithTimeout(context.Background(), recordTimeout)
		w, err := inc.brain.writeRecord(ctx, title, roster, events)
		cancel()
		if err != nil {
			slog.Error("write record with model", "err", err)
		} else {
			written, by = w, "claude"
		}
	}
	inc.mu.Lock()
	inc.written, inc.writtenBy = &written, by
	rec := inc.record()
	inc.mu.Unlock()
	inc.deliverActionItems(rec)

	if inc.store == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
	defer cancel()
	err := inc.store.saveRecord(ctx, storedRecord{
		PastMatch:    PastMatch{ID: inc.id, Summary: written.Summary, FixedBy: written.FixedBy},
		Title:        rec.Title,
		Opened:       rec.Opened,
		Resolved:     rec.Resolved,
		Parts:        written.Parts,
		Improvements: rec.ActionItems,
	})
	if err != nil {
		slog.Error("store record", "err", err)
	}
}

const matchEvents = 10

func (inc *Incident) refreshPastMatch() {
	if inc.store == nil {
		return
	}
	select {
	case inc.matchReq <- struct{}{}:
	default:
	}
}

func (inc *Incident) matchLoop() {
	var lastQuery string
	for range inc.matchReq {
		inc.mu.Lock()
		query := incidentText(inc.title, inc.events[:min(len(inc.events), matchEvents)])
		inc.mu.Unlock()
		if query == lastQuery {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
		match, err := inc.store.closestRecord(ctx, inc.id, query)
		cancel()
		if err != nil {
			slog.Error("find past match", "err", err)
			continue
		}
		lastQuery = query
		inc.mu.Lock()
		inc.pastMatch = match
		inc.mu.Unlock()
		inc.broadcast()
	}
}

func incidentText(title string, events []Event) string {
	var b strings.Builder
	b.WriteString(title)
	for _, ev := range events {
		fmt.Fprintf(&b, ". %s", ev.Text)
	}
	return b.String()
}
