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
	return inc.recordOf(inc.id, inc.title, inc.currentEvents(), inc.written, inc.writtenBy)
}

func (inc *Incident) recordOf(id, title string, events []Event, written *writtenRecord, writtenBy string) Record {
	status, severity := lifecycleOf(events)
	win := window(events)
	content, by := fallbackRecord(title, events), captainMorgue
	if written != nil && status == "closed" {
		content, by = *written, writtenBy
	}
	rec := Record{
		ID: id, Title: title, Status: status, Severity: severity, WrittenBy: by,
		Opened: win.Opened, Resolved: win.Resolved, Duration: win.Duration, Window: win,
		Summary: content.Summary, FixedBy: content.FixedBy, RootCause: content.RootCause, ContributingFactors: content.ContributingFactors,
		Timeline:    moments(events, func(ev Event) bool { return keyEvents[ev.Type] }),
		WentWell:    content.WentWell,
		WentBadly:   content.WentBadly,
		Errors:      incidentErrors(events),
		Remediation: prsOf(events),
		ActionItems: explicitActionItems(events, severity),
		Parts:       content.Parts, Events: events,
	}
	if id == inc.id {
		rec.PastMatch = inc.pastMatch
	}
	rec.Steps, rec.Changes = steps(events)
	for _, a := range content.Improvements {
		if a.Due == "" {
			a.Due = dueBySeverity[severity]
		}
		rec.ActionItems = append(rec.ActionItems, a)
	}
	people, teams := map[string]bool{}, map[string]bool{}
	for _, ev := range events {
		if inc.teamOf(ev.Actor) != "" {
			people[ev.Actor] = true
		}
		if ev.Team != "" {
			teams[ev.Team] = true
		}
		if ev.Type == "conflict" {
			rec.Conflicts++
		}
	}
	rec.People = len(people)
	rec.Teams = len(teams)
	rec.Improvements = rec.ActionItems
	return rec
}

func (rec Record) summary() RecordSummary {
	return RecordSummary{ID: rec.ID, Title: rec.Title, Status: rec.Status, Severity: rec.Severity, Opened: rec.Opened, Resolved: rec.Resolved, Duration: rec.Duration, Summary: rec.Summary, FixedBy: rec.FixedBy}
}

func (inc *Incident) currentEvents() []Event {
	return slices.DeleteFunc(slices.Clone(inc.events), func(ev Event) bool { return ev.IncidentID != inc.id })
}

func (inc *Incident) documented() bool {
	status, _ := inc.lifecycleStatus()
	return status == "closed" || slices.ContainsFunc(inc.events, func(ev Event) bool { return ev.IncidentID == inc.id && ev.Type == "open" })
}

func (inc *Incident) handleRecord(w http.ResponseWriter, r *http.Request) {
	id, asMarkdown := strings.CutSuffix(r.PathValue("id"), ".md")
	inc.mu.Lock()
	rec, found := inc.records[id]
	if id == inc.id {
		rec, found = inc.record(), true
	}
	inc.mu.Unlock()
	if !found {
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

func openedAt(rec Record) time.Time {
	if rec.Opened == nil {
		return time.Time{}
	}
	return *rec.Opened
}

func (inc *Incident) handleRecords(w http.ResponseWriter, r *http.Request) {
	byID := map[string]Record{}
	if inc.store != nil {
		ctx, cancel := context.WithTimeout(r.Context(), esTimeout)
		stored, err := inc.store.listRecords(ctx)
		cancel()
		if err != nil {
			slog.Error("list stored records", "err", err)
		}
		for _, rec := range stored {
			byID[rec.ID] = rec
		}
	}
	inc.mu.Lock()
	maps.Copy(byID, inc.records)
	if inc.documented() {
		rec := inc.record()
		rec.Events = nil
		byID[rec.ID] = rec
	}
	inc.mu.Unlock()
	recs := slices.SortedFunc(maps.Values(byID), func(a, b Record) int { return openedAt(b).Compare(openedAt(a)) })
	if r.URL.Query().Get("full") == "1" {
		writeJSON(w, recs)
		return
	}
	out := make([]RecordSummary, len(recs))
	for i, rec := range recs {
		out[i] = rec.summary()
	}
	writeJSON(w, out)
}

func (inc *Incident) saveRecord(rec Record) {
	rec.Events = nil
	inc.saveMu.Lock()
	defer inc.saveMu.Unlock()
	inc.mu.Lock()
	prev, ok := inc.records[rec.ID]
	final := ok && prev.Status == "closed" && rec.Status != "closed"
	if !final {
		inc.records[rec.ID] = rec
	}
	inc.mu.Unlock()
	if final || inc.store == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
	defer cancel()
	if err := inc.store.saveRecord(ctx, rec); err != nil {
		slog.Error("store record", "id", rec.ID, "err", err)
	}
}

func (inc *Incident) saveDraft() {
	inc.mu.Lock()
	open := inc.isOpen()
	rec := inc.record()
	inc.mu.Unlock()
	if open {
		inc.saveRecord(rec)
	}
}

func (inc *Incident) draftLoop(every time.Duration) {
	drafted := 0
	for range time.Tick(every) {
		inc.mu.Lock()
		n, open := len(inc.events), inc.isOpen()
		inc.mu.Unlock()
		if open && n != drafted {
			inc.saveDraft()
			drafted = n
		}
	}
}

func (inc *Incident) writeRecord() {
	inc.mu.Lock()
	id, title, events := inc.id, inc.title, inc.currentEvents()
	roster := inc.liveRoster()
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
	if inc.id == id {
		inc.written, inc.writtenBy = &written, by
	}
	rec := inc.recordOf(id, title, events, &written, by)
	inc.mu.Unlock()
	inc.saveRecord(rec)
	inc.deliverActionItems(rec)
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
		id, events := inc.id, inc.currentEvents()
		query := incidentText(inc.title, events[:min(len(events), matchEvents)])
		inc.mu.Unlock()
		if query == lastQuery {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), esTimeout)
		match, err := inc.store.closestRecord(ctx, id, query)
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
