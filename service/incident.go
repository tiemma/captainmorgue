package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Resource struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name"`
}

type Artifact struct {
	Label string `json:"label"`
	URL   string `json:"url,omitempty"`
}

type Event struct {
	ID         string     `json:"id"`
	Seq        int        `json:"seq"`
	IncidentID string     `json:"incident_id"`
	TS         time.Time  `json:"ts"`
	Actor      string     `json:"actor"`
	Team       string     `json:"team,omitempty"`
	Type       string     `json:"type"`
	Text       string     `json:"text"`
	Resource   *Resource  `json:"resource,omitempty"`
	Artifacts  []Artifact `json:"artifacts,omitempty"`
	To         []string   `json:"to,omitempty"`
	Why        string     `json:"why,omitempty"`
}

var eventTypes = map[string]bool{
	"alert": true, "action": true, "decision": true, "relay": true, "conflict": true,
	"investigation": true, "signal": true, "ship": true, "join": true, "close": true,
}

var readVerbs = []string{"get ", "describe", "read", "checked", "logs", "list", "query"}

const conflictWindow = 2 * time.Minute

type sseMessage struct {
	name string
	data []byte
}

type Incident struct {
	id, title string
	roster    Roster

	mu     sync.Mutex
	events []Event
	subs   map[chan sseMessage]struct{}
}

func newIncident(id, title string, roster Roster) *Incident {
	return &Incident{id: id, title: title, roster: roster, subs: map[chan sseMessage]struct{}{}}
}

func (inc *Incident) handleEvent(w http.ResponseWriter, r *http.Request) {
	var ev Event
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		http.Error(w, "event must be JSON matching docs/hackathon-plan.md", http.StatusBadRequest)
		return
	}
	if !eventTypes[ev.Type] || ev.Actor == "" {
		http.Error(w, "event needs an actor and a known type", http.StatusBadRequest)
		return
	}
	inc.append(ev)
	w.WriteHeader(http.StatusAccepted)
}

func (inc *Incident) append(ev Event) {
	inc.mu.Lock()
	ev.Seq = len(inc.events) + 1
	ev.ID = fmt.Sprintf("%s-%d", inc.id, ev.Seq)
	ev.IncidentID = inc.id
	if ev.TS.IsZero() {
		ev.TS = time.Now().UTC()
	}
	if ev.Team == "" {
		if t, ok := inc.roster.teamOf(ev.Actor); ok {
			ev.Team = t.ID
		}
	}
	inc.events = append(inc.events, ev)
	conflict, found := inc.conflictWith(ev)
	inc.mu.Unlock()

	inc.publish(ev)
	if found {
		inc.append(conflict)
	}
}

func looksLikeWrite(ev Event) bool {
	if ev.Type != "action" && ev.Type != "decision" {
		return false
	}
	text := strings.ToLower(ev.Text)
	for _, verb := range readVerbs {
		if strings.HasPrefix(text, verb) {
			return false
		}
	}
	return true
}

func (inc *Incident) conflictWith(ev Event) (Event, bool) {
	if ev.Resource == nil || ev.Type == "conflict" {
		return Event{}, false
	}
	for i := len(inc.events) - 2; i >= 0; i-- {
		prev := inc.events[i]
		if ev.TS.Sub(prev.TS) > conflictWindow {
			break
		}
		if prev.Type == "conflict" || prev.Resource == nil || prev.Actor == ev.Actor || *prev.Resource != *ev.Resource {
			continue
		}
		if !looksLikeWrite(prev) && !looksLikeWrite(ev) {
			continue
		}
		target := ev.Resource.Kind + "/" + ev.Resource.Name
		return Event{
			Actor:    "captainmorgue",
			Type:     "conflict",
			Text:     fmt.Sprintf("%s is acting on %s while %s's %q is still in effect. Check with each other before going on.", ev.Actor, target, prev.Actor, prev.Text),
			Resource: ev.Resource,
			To:       []string{prev.Actor, ev.Actor},
			Why:      fmt.Sprintf("Both acted on %s within %s.", target, conflictWindow),
		}, true
	}
	return Event{}, false
}

func (inc *Incident) handleBroadcast(w http.ResponseWriter, r *http.Request) {
	var b struct {
		From string `json:"from"`
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.From == "" || b.Text == "" {
		http.Error(w, "broadcast needs from and text", http.StatusBadRequest)
		return
	}
	to := inc.managersOfOtherTeams(b.From)
	inc.append(Event{Actor: b.From, Type: "relay", Text: b.Text, To: to, Why: "Managers of the other teams working this incident."})
	w.WriteHeader(http.StatusAccepted)
}

func (inc *Incident) managersOfOtherTeams(from string) []string {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	fromTeam, _ := inc.roster.teamOf(from)
	inIncident := inc.teamsInIncident()
	var to []string
	for _, t := range inc.roster.Teams {
		if t.ID != fromTeam.ID && inIncident[t.ID] {
			to = append(to, t.Manager)
		}
	}
	return to
}

func (inc *Incident) teamsInIncident() map[string]bool {
	in := map[string]bool{}
	for _, ev := range inc.events {
		if ev.Team != "" {
			in[ev.Team] = true
		}
	}
	return in
}

func (inc *Incident) publish(ev Event) {
	evData, err := json.Marshal(ev)
	if err != nil {
		slog.Error("marshal event", "err", err)
		return
	}
	inc.mu.Lock()
	defer inc.mu.Unlock()
	stateData, err := json.Marshal(inc.state())
	if err != nil {
		slog.Error("marshal state", "err", err)
		return
	}
	for ch := range inc.subs {
		for _, m := range []sseMessage{{"event", evData}, {"state", stateData}} {
			select {
			case ch <- m:
			default:
				slog.Warn("dropping message for slow stream subscriber")
			}
		}
	}
}

func (inc *Incident) handleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan sseMessage, 256)
	inc.mu.Lock()
	backlog := append([]Event(nil), inc.events...)
	stateData, err := json.Marshal(inc.state())
	inc.subs[ch] = struct{}{}
	inc.mu.Unlock()
	defer func() {
		inc.mu.Lock()
		delete(inc.subs, ch)
		inc.mu.Unlock()
	}()
	if err != nil {
		slog.Error("marshal state", "err", err)
		return
	}

	write := func(m sseMessage) bool {
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", m.name, m.data); err != nil {
			slog.Debug("stream client gone", "err", err)
			return false
		}
		flusher.Flush()
		return true
	}
	for _, ev := range backlog {
		b, err := json.Marshal(ev)
		if err != nil {
			slog.Error("marshal event", "err", err)
			continue
		}
		if !write(sseMessage{"event", b}) {
			return
		}
	}
	if !write(sseMessage{"state", stateData}) {
		return
	}

	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case m := <-ch:
			if !write(m) {
				return
			}
		case <-keepalive.C:
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				slog.Debug("stream client gone", "err", err)
				return
			}
			flusher.Flush()
		}
	}
}
