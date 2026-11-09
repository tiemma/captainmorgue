package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"slices"
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
	Label   string    `json:"label,omitempty"`
	Service string    `json:"service,omitempty"`
	Value   string    `json:"value"`
	Status  string    `json:"status"`
	Series  []float64 `json:"series,omitempty"`
	Spark   []float64 `json:"spark,omitempty"`
}

type Counts struct {
	Parts       int `json:"parts"`
	Claims      int `json:"claims"`
	CrewOnline  int `json:"crew_online"`
	CrewTotal   int `json:"crew_total"`
	Events      int `json:"events"`
	OpenAsks    int `json:"open_asks"`
	OpenPRs     int `json:"open_prs"`
	ActionItems int `json:"action_items"`
}

type State struct {
	Incident  IncidentSummary   `json:"incident"`
	Counts    Counts            `json:"counts"`
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
		Parts:     incidentParts(inc.events),
		Signals:   maps.Clone(inc.signals),
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
	openAsks := map[int]bool{}
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
		case "ask":
			openAsks[ev.Seq] = true
		case "reply":
			delete(openAsks, ev.ReplyTo)
		}
	}
	s.Counts = Counts{
		Parts: len(s.Parts), Claims: len(s.Claims), CrewTotal: len(s.People), Events: len(inc.events),
		OpenAsks: len(openAsks), OpenPRs: len(s.PRs), ActionItems: len(explicitActionItems(inc.events, severity)),
	}
	for _, p := range s.People {
		if p.Status == "online" {
			s.Counts.CrewOnline++
		}
	}
	return s
}

var partProgress = map[string]int{"investigating": 0, "mitigated": 50, "resolved": 100}

func incidentParts(events []Event) []Part {
	out := []Part{}
	index := map[string]int{}
	for _, ev := range events {
		if ev.Type == "open" {
			out, index = []Part{}, map[string]int{}
		}
		if ev.Part == "" || (ev.Type != "note" && ev.Type != "status") {
			continue
		}
		i, ok := index[ev.Part]
		if !ok {
			i, index[ev.Part] = len(out), len(out)
			out = append(out, Part{ID: ev.Part, Name: ev.Part, Owner: ev.Actor, Status: "investigating"})
		}
		p := &out[i]
		if ev.Type == "note" {
			p.Note = ev.Text
			continue
		}
		p.Status, p.Progress = ev.Status, partProgress[ev.Status]
		if p.ResolvedAt == nil {
			p.ResolvedAt = &ev.TS
		}
	}
	return out
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
	FixedBy             string        `json:"fixed_by"`
	RootCause           string        `json:"root_cause"`
	ContributingFactors []string      `json:"contributing_factors"`
	Timeline            []Moment      `json:"timeline"`
	WentWell            []string      `json:"went_well"`
	WentBadly           []string      `json:"went_badly"`
	Errors              []Moment      `json:"errors"`
	Remediation         []PR          `json:"remediation"`
	ActionItems         []Improvement `json:"action_items"`
	Improvements        []Improvement `json:"improvements"`
	Steps               []StepGroup   `json:"steps"`
	Changes             []Step        `json:"changes"`
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
		Summary: written.Summary, FixedBy: written.FixedBy, RootCause: written.RootCause, ContributingFactors: written.ContributingFactors,
		Timeline:    moments(inc.events, func(ev Event) bool { return keyEvents[ev.Type] }),
		WentWell:    written.WentWell,
		WentBadly:   written.WentBadly,
		Errors:      incidentErrors(inc.events),
		Remediation: inc.prs(),
		ActionItems: explicitActionItems(inc.events, severity),
		Parts:       written.Parts, PastMatch: inc.pastMatch, Events: inc.events,
	}
	rec.Steps, rec.Changes = steps(inc.events)
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
	rec.Improvements = rec.ActionItems
	return rec
}

func (inc *Incident) handleRecord(w http.ResponseWriter, r *http.Request) {
	id, asMarkdown := strings.CutSuffix(r.PathValue("id"), ".md")
	var rec Record
	if id == inc.id {
		inc.mu.Lock()
		rec = inc.record()
		inc.mu.Unlock()
	} else {
		stored, err := inc.storedRecord(r.Context(), id)
		if err != nil {
			slog.Error("read stored record", "id", id, "err", err)
			http.Error(w, "the record could not be read", http.StatusBadGateway)
			return
		}
		if stored == nil {
			http.Error(w, "no such incident", http.StatusNotFound)
			return
		}
		rec = *stored
	}
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

func (inc *Incident) storedRecord(ctx context.Context, id string) (*Record, error) {
	if inc.store == nil {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(ctx, esTimeout)
	defer cancel()
	return inc.store.getRecord(ctx, id)
}

func (inc *Incident) handleRecords(w http.ResponseWriter, r *http.Request) {
	inc.mu.Lock()
	rec := inc.record()
	inc.mu.Unlock()
	out := []RecordSummary{}
	if inc.store != nil {
		ctx, cancel := context.WithTimeout(r.Context(), esTimeout)
		stored, err := inc.store.listRecords(ctx)
		cancel()
		if err != nil {
			slog.Error("list stored records", "err", err)
		}
		out = append(out, stored...)
	}
	if rec.Status == "closed" && !slices.ContainsFunc(out, func(s RecordSummary) bool { return s.ID == rec.ID }) {
		out = append([]RecordSummary{{ID: rec.ID, Title: rec.Title, Severity: rec.Severity, Opened: rec.Opened, Resolved: rec.Resolved, Duration: rec.Duration, Summary: rec.Summary, FixedBy: rec.FixedBy}}, out...)
	}
	writeJSON(w, out)
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
	stored := rec
	stored.Events = nil
	ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
	defer cancel()
	err := inc.store.saveRecord(ctx, storedRecord{
		PastMatch:    PastMatch{ID: inc.id, Summary: written.Summary, FixedBy: written.FixedBy},
		Title:        rec.Title,
		Severity:     rec.Severity,
		Duration:     rec.Duration,
		RFO:          &stored,
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
