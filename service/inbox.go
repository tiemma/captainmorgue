package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
)

const maxWait = 25 * time.Second

type Envelope struct {
	ID       string    `json:"id"`
	Seq      int       `json:"seq"`
	TS       time.Time `json:"ts"`
	From     string    `json:"from"`
	To       []string  `json:"to"`
	Kind     string    `json:"kind"`
	Text     string    `json:"text"`
	Why      string    `json:"why"`
	Term     int       `json:"term"`
	Priority string    `json:"priority"`
	ReplyTo  int       `json:"reply_to,omitempty"`
}

var envelopePriority = map[string]string{
	"ask": "interrupt", "conflict": "interrupt", "vote_request": "interrupt", "escalation": "interrupt",
	"broadcast": "inject", "relay": "inject", "election": "inject", "autoreply": "inject", "reply": "inject", "digest": "inject",
}

var trackedKinds = map[string]bool{"ask": true, "broadcast": true, "relay": true, "conflict": true}

func (inc *Incident) deliver(ev Event) {
	priority, ok := envelopePriority[ev.Type]
	if !ok {
		return
	}
	c := &inc.coord
	env := Envelope{
		ID: ev.ID, Seq: ev.Seq, TS: ev.TS, From: ev.Actor, To: ev.To, Kind: ev.Type,
		Text: ev.Text, Why: ev.Why, Term: ev.Term, Priority: priority, ReplyTo: ev.ReplyTo,
	}
	for i, to := range ev.To {
		if slices.Contains(ev.To[:i], to) {
			continue
		}
		a := c.actor(to)
		a.inbox = append(a.inbox, env)
		close(a.wake)
		a.wake = make(chan struct{})
		if trackedKinds[ev.Type] {
			if c.deliveries[ev.Seq] == nil {
				c.deliveries[ev.Seq] = map[string]string{}
			}
			c.deliveries[ev.Seq][to] = "sent"
		}
	}
	if ev.Type == "ask" {
		c.asks[ev.Seq] = ev
		c.pending = append(c.pending, ev.Seq)
	}
}

func (inc *Incident) publishState() {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	data, err := json.Marshal(inc.state())
	if err != nil {
		slog.Error("marshal state", "err", err)
		return
	}
	for ch := range inc.subs {
		select {
		case ch <- sseMessage{"state", data}:
		default:
			slog.Warn("dropping state for slow stream subscriber")
		}
	}
}

func queryInt(r *http.Request, key string) (int, bool, error) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return 0, false, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, false, fmt.Errorf("%s must be a number: %w", key, err)
	}
	return n, true, nil
}

func (inc *Incident) handleInbox(w http.ResponseWriter, r *http.Request) {
	actor := r.PathValue("actor")
	after, hasAfter, err := queryInt(r, "after")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	waitSecs, _, err := queryInt(r, "wait")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	wait := min(time.Duration(max(waitSecs, 0))*time.Second, maxWait)
	timer := time.NewTimer(wait)
	defer timer.Stop()

	for {
		inc.mu.Lock()
		a := inc.coord.actor(actor)
		if !hasAfter {
			after, hasAfter = a.cursor, true
		}
		var msgs []Envelope
		for _, m := range a.inbox {
			if m.Seq > after {
				msgs = append(msgs, m)
			}
		}
		marked := false
		for _, m := range msgs {
			if d := inc.coord.deliveries[m.Seq]; d != nil && d[actor] == "sent" {
				d[actor], marked = "delivered", true
			}
		}
		wake := a.wake
		inc.mu.Unlock()

		if len(msgs) > 0 {
			if marked {
				inc.publishState()
			}
			writeJSON(w, map[string]any{"messages": msgs, "cursor": msgs[len(msgs)-1].Seq})
			return
		}
		select {
		case <-wake:
		case <-timer.C:
			writeJSON(w, map[string]any{"messages": []Envelope{}, "cursor": after})
			return
		case <-r.Context().Done():
			slog.Debug("inbox poll closed", "actor", actor, "err", r.Context().Err())
			return
		}
	}
}

func (inc *Incident) handleAck(w http.ResponseWriter, r *http.Request) {
	actor := r.PathValue("actor")
	var req struct {
		Seq int `json:"seq"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	inc.mu.Lock()
	a := inc.coord.actor(actor)
	a.cursor = max(a.cursor, req.Seq)
	changed := false
	for seq, d := range inc.coord.deliveries {
		if seq <= req.Seq && d[actor] != "" && d[actor] != "seen" {
			d[actor], changed = "seen", true
		}
	}
	inc.mu.Unlock()
	if changed {
		inc.publishState()
	}
	w.WriteHeader(http.StatusNoContent)
}

func (inc *Incident) handleMessages(w http.ResponseWriter, r *http.Request) {
	var req struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Kind    string   `json:"kind"`
		Text    string   `json:"text"`
		ReplyTo int      `json:"reply_to"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.From == "" || req.Text == "" || (req.Kind != "ask" && req.Kind != "broadcast" && req.Kind != "reply") {
		http.Error(w, "message needs from, text and kind ask, broadcast or reply", http.StatusBadRequest)
		return
	}

	inc.mu.Lock()
	c := &inc.coord
	term := c.team(inc.teamOf(req.From)).term
	var to []string
	var why string
	if req.Kind == "reply" {
		ask, ok := c.asks[req.ReplyTo]
		if !ok {
			inc.mu.Unlock()
			http.Error(w, "reply_to must be the seq of an ask", http.StatusBadRequest)
			return
		}
		c.pending = slices.DeleteFunc(c.pending, func(seq int) bool { return seq == req.ReplyTo })
		if d := c.deliveries[req.ReplyTo]; d != nil && d[req.From] != "" {
			d[req.From] = "seen"
		}
		to, why = []string{ask.Actor}, fmt.Sprintf("%s answered %s's ask.", req.From, ask.Actor)
	} else {
		var err error
		if to, why, err = inc.expand(req.From, req.To); err != nil {
			inc.mu.Unlock()
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	inc.mu.Unlock()

	ev := inc.append(Event{Actor: req.From, Type: req.Kind, Text: req.Text, To: to, Why: why, Term: term, ReplyTo: req.ReplyTo})
	writeJSON(w, map[string]any{"seq": ev.Seq, "to": to, "why": why})
}

func (inc *Incident) expand(from string, targets []string) ([]string, string, error) {
	to := []string{}
	var whys []string
	add := func(names []string) {
		for _, n := range names {
			if n != from && !slices.Contains(to, n) {
				to = append(to, n)
			}
		}
	}
	for _, t := range targets {
		if t == "root" {
			add(inc.coord.joinedNames())
			whys = append(whys, "everyone who joined "+inc.id)
			continue
		}
		if rt, ok := inc.roster.team(t); ok {
			add(inc.coord.joinedIn(t))
			whys = append(whys, rt.Name+" members who joined "+inc.id)
			continue
		}
		if _, known := inc.coord.actors[t]; !known && inc.teamOf(t) == "" {
			return nil, "", fmt.Errorf("unknown recipient %q: use a person, a team id from roster.yaml, or root", t)
		}
		if !slices.Contains(to, t) {
			to = append(to, t)
		}
		whys = append(whys, "sent to "+t+" directly")
	}
	if len(whys) == 0 {
		return nil, "", fmt.Errorf("message needs at least one recipient in to")
	}
	return to, strings.Join(whys, "; "), nil
}
