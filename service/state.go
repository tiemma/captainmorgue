package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type IncidentSummary struct {
	ID     string     `json:"id"`
	Title  string     `json:"title"`
	Status string     `json:"status"`
	Opened *time.Time `json:"opened"`
	Closed *time.Time `json:"closed"`
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

	Deliveries map[int]map[string]string `json:"deliveries"`
}

func (inc *Incident) state() State {
	s := State{
		Incident:  IncidentSummary{ID: inc.id, Title: inc.title, Status: "open"},
		People:    inc.people(time.Now().UTC()),
		Parts:     []Part{},
		Signals:   map[string]Signal{},
		PastMatch: inc.pastMatch,

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
		switch ev.Type {
		case "relay", "broadcast":
			s.Relay = &Relay{From: ev.Actor, To: ev.To, Text: ev.Text, Why: ev.Why}
		case "conflict":
			s.Conflict = ev
		case "close":
			s.Incident.Status = "resolved"
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
}

type Record struct {
	ID           string        `json:"id"`
	Title        string        `json:"title"`
	Opened       *time.Time    `json:"opened"`
	Resolved     *time.Time    `json:"resolved"`
	Duration     string        `json:"duration"`
	People       int           `json:"people"`
	Teams        int           `json:"teams"`
	Conflicts    int           `json:"conflicts"`
	Parts        []RecordPart  `json:"parts"`
	Improvements []Improvement `json:"improvements"`
	PastMatch    *PastMatch    `json:"past_match"`
	Events       []Event       `json:"events"`
}

func (inc *Incident) record() Record {
	s := inc.state()
	rec := Record{
		ID: inc.id, Title: inc.title, Opened: s.Incident.Opened, Resolved: s.Incident.Closed,
		Parts: []RecordPart{}, Improvements: []Improvement{}, PastMatch: inc.pastMatch, Events: inc.events,
	}
	if inc.written != nil {
		rec.Parts, rec.Improvements = inc.written.Parts, inc.written.Improvements
	}
	people := map[string]bool{}
	for _, ev := range inc.events {
		if _, ok := inc.roster.teamOf(ev.Actor); ok {
			people[ev.Actor] = true
		}
		if ev.Type == "conflict" {
			rec.Conflicts++
		}
	}
	rec.People = len(people)
	rec.Teams = len(inc.teamsInIncident())
	if rec.Opened != nil && rec.Resolved != nil {
		rec.Duration = fmt.Sprintf("%d min", int(rec.Resolved.Sub(*rec.Opened).Minutes()))
	}
	return rec
}

func (inc *Incident) handleRecord(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	inc.mu.Lock()
	rec := inc.record()
	inc.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(rec); err != nil {
		slog.Debug("write record", "err", err)
	}
}

func (inc *Incident) writeRecord() {
	inc.mu.Lock()
	events := append([]Event(nil), inc.events...)
	rec := inc.record()
	roster := inc.liveRoster()
	inc.mu.Unlock()

	written := writtenRecord{Summary: incidentText(inc.title, events), Parts: []RecordPart{}, Improvements: []Improvement{}}
	if inc.brain != nil {
		ctx, cancel := context.WithTimeout(context.Background(), recordTimeout)
		w, err := inc.brain.writeRecord(ctx, inc.title, roster, events)
		cancel()
		if err != nil {
			slog.Error("write record with model", "err", err)
		} else {
			written = w
		}
	}
	inc.mu.Lock()
	inc.written = &written
	inc.mu.Unlock()

	if inc.store == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
	defer cancel()
	err := inc.store.saveRecord(ctx, storedRecord{
		PastMatch:    PastMatch{ID: inc.id, Summary: written.Summary, FixedBy: written.FixedBy},
		Title:        inc.title,
		Opened:       rec.Opened,
		Resolved:     rec.Resolved,
		Parts:        written.Parts,
		Improvements: written.Improvements,
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
