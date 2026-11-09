package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
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
	Incident IncidentSummary   `json:"incident"`
	Teams    []TeamState       `json:"teams"`
	People   map[string]string `json:"people"`
	Parts    []Part            `json:"parts"`
	Relay    *Relay            `json:"relay"`
	Conflict *Event            `json:"conflict"`
	Signals  map[string]Signal `json:"signals"`
}

func (inc *Incident) state() State {
	s := State{
		Incident: IncidentSummary{ID: inc.id, Title: inc.title, Status: "open"},
		People:   map[string]string{},
		Parts:    []Part{},
		Signals:  map[string]Signal{},
	}
	if len(inc.events) > 0 {
		s.Incident.Opened = &inc.events[0].TS
	}
	inIncident := inc.teamsInIncident()
	for _, t := range inc.roster.Teams {
		s.Teams = append(s.Teams, TeamState{Team: t, PulledIn: inIncident[t.ID]})
	}
	for i := range inc.events {
		ev := &inc.events[i]
		switch ev.Type {
		case "join":
			s.People[ev.Actor] = "in_incident"
		case "action", "decision":
			s.People[ev.Actor] = "working"
		case "relay":
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

type Record struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Opened    *time.Time `json:"opened"`
	Resolved  *time.Time `json:"resolved"`
	Duration  string     `json:"duration"`
	People    int        `json:"people"`
	Teams     int        `json:"teams"`
	Conflicts int        `json:"conflicts"`
	Events    []Event    `json:"events"`
}

func (inc *Incident) record() Record {
	s := inc.state()
	rec := Record{ID: inc.id, Title: inc.title, Opened: s.Incident.Opened, Resolved: s.Incident.Closed, Events: inc.events}
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
