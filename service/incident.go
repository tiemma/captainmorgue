package main

import (
	"context"
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
	Term       int        `json:"term,omitempty"`
	ReplyTo    int        `json:"reply_to,omitempty"`
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
	store     *store
	brain     *brain

	mu        sync.Mutex
	events    []Event
	subs      map[chan sseMessage]struct{}
	pastMatch *PastMatch
	written   *writtenRecord
	matchReq  chan struct{}
	coord     coord
}

func newIncident(id, title string, roster Roster, st *store, br *brain) *Incident {
	return &Incident{
		id: id, title: title, roster: roster, store: st, brain: br,
		subs:     map[chan sseMessage]struct{}{},
		matchReq: make(chan struct{}, 1),
	}
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

func (inc *Incident) append(ev Event) Event {
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
	inc.deliver(ev)
	prev, found := inc.conflictWith(ev)
	inc.mu.Unlock()

	inc.store.saveEvent(ev)
	inc.publish(ev)
	inc.refreshPastMatch()
	if ev.Type == "close" {
		go inc.writeRecord()
	}
	if !found {
		return ev
	}
	conflict := conflictEvent(prev, ev)
	if inc.brain == nil {
		inc.append(conflict)
		return ev
	}
	go inc.confirmConflict(prev, ev, conflict)
	return ev
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
		return prev, true
	}
	return Event{}, false
}

func resourceLabel(r *Resource) string {
	return r.Kind + "/" + r.Name
}

func conflictEvent(prev, ev Event) Event {
	target := resourceLabel(ev.Resource)
	return Event{
		Actor:    "captainmorgue",
		Type:     "conflict",
		Text:     fmt.Sprintf("%s is acting on %s while %s's %q is still in effect. Check with each other before going on.", ev.Actor, target, prev.Actor, prev.Text),
		Resource: ev.Resource,
		To:       []string{prev.Actor, ev.Actor},
		Why:      fmt.Sprintf("Both acted on %s within %s.", target, conflictWindow),
	}
}

func (inc *Incident) confirmConflict(prev, ev, conflict Event) {
	ctx, cancel := context.WithTimeout(context.Background(), modelTimeout)
	defer cancel()
	verdict, err := inc.brain.judgeConflict(ctx, prev, ev)
	switch {
	case err != nil:
		slog.Warn("conflict check failed, keeping the rule", "err", err)
	case !verdict.Conflict:
		slog.Info("model dismissed conflict", "a", prev.ID, "b", ev.ID, "why", verdict.Why)
		return
	case verdict.Why != "":
		conflict.Why = verdict.Why
	}
	inc.append(conflict)
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
	go inc.relay(b.From, b.Text)
	w.WriteHeader(http.StatusAccepted)
}

func (inc *Incident) relay(from, text string) {
	to, why := inc.managersOfOtherTeams(from), "Managers of the other teams working this incident."
	if inc.brain != nil {
		inc.mu.Lock()
		recent := inc.events[max(0, len(inc.events)-relayContext):]
		recent = append([]Event(nil), recent...)
		roster := inc.liveRoster()
		inc.mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), modelTimeout)
		pick, err := inc.brain.pickRecipients(ctx, roster, from, text, recent)
		cancel()
		if err != nil {
			slog.Warn("relay pick failed, using managers", "err", err)
		} else if known := inc.knownActors(pick.To, from); len(known) > 0 {
			to, why = known, pick.Why
		}
	}
	inc.append(Event{Actor: from, Type: "relay", Text: text, To: to, Why: why})
}

func (inc *Incident) managersOfOtherTeams(from string) []string {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	fromTeam := inc.teamOf(from)
	inIncident := inc.teamsInIncident()
	var to []string
	for _, t := range inc.roster.Teams {
		if m := inc.coord.team(t.ID).manager; t.ID != fromTeam && inIncident[t.ID] && m != "" {
			to = append(to, m)
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
	inc.broadcast(sseMessage{"event", evData})
}

func (inc *Incident) broadcast(msgs ...sseMessage) {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	stateData, err := json.Marshal(inc.state())
	if err != nil {
		slog.Error("marshal state", "err", err)
		return
	}
	msgs = append(msgs, sseMessage{"state", stateData})
	for ch := range inc.subs {
		for _, m := range msgs {
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
