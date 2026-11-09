package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
)

const captainMorgue = "captainmorgue"

type actorState struct {
	team     string
	joined   bool
	lastSeen time.Time
	cursor   int
	status   string
	inbox    []Envelope
	wake     chan struct{}
}

type election struct {
	term      int
	candidate string
	votes     map[string]bool
}

type teamCoord struct {
	manager  string
	term     int
	election *election
}

type coord struct {
	suspectAfter, offlineAfter, askTimeout time.Duration

	actors     map[string]*actorState
	teams      map[string]*teamCoord
	deliveries map[int]map[string]string
	asks       map[int]Event
	pending    []int
}

type Person struct {
	Status   string     `json:"status"`
	Team     string     `json:"team"`
	LastSeen *time.Time `json:"last_seen"`
}

type MemberStatus struct {
	Actor  string `json:"actor"`
	Status string `json:"status"`
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", key, err)
	}
	return d, nil
}

func (inc *Incident) startCoord() error {
	c := coord{
		actors:     map[string]*actorState{},
		teams:      map[string]*teamCoord{},
		deliveries: map[int]map[string]string{},
		asks:       map[int]Event{},
	}
	var err error
	if c.suspectAfter, err = envDuration("CM_SUSPECT_AFTER", 15*time.Second); err != nil {
		return err
	}
	if c.offlineAfter, err = envDuration("CM_OFFLINE_AFTER", 30*time.Second); err != nil {
		return err
	}
	if c.askTimeout, err = envDuration("CM_ASK_TIMEOUT", 60*time.Second); err != nil {
		return err
	}
	inc.mu.Lock()
	inc.coord = c
	inc.mu.Unlock()
	go inc.watch(time.Second)
	return nil
}

func (c *coord) actor(name string) *actorState {
	a, ok := c.actors[name]
	if !ok {
		a = &actorState{status: "offline", wake: make(chan struct{})}
		c.actors[name] = a
	}
	return a
}

func (c *coord) team(id string) *teamCoord {
	t, ok := c.teams[id]
	if !ok {
		t = &teamCoord{}
		c.teams[id] = t
	}
	return t
}

func (c *coord) status(name string, now time.Time) string {
	a, ok := c.actors[name]
	if !ok || !a.joined {
		return "offline"
	}
	since := now.Sub(a.lastSeen)
	switch {
	case since >= c.offlineAfter:
		return "offline"
	case since >= c.suspectAfter:
		return "suspect"
	}
	return "online"
}

func (c *coord) joinedNames() []string {
	var names []string
	for name, a := range c.actors {
		if a.joined {
			names = append(names, name)
		}
	}
	slices.Sort(names)
	return names
}

func (c *coord) joinedIn(team string) []string {
	var names []string
	for _, name := range c.joinedNames() {
		if c.actors[name].team == team {
			names = append(names, name)
		}
	}
	return names
}

func (c *coord) onlineIn(team string, now time.Time) []string {
	var names []string
	for _, name := range c.joinedIn(team) {
		if c.status(name, now) == "online" {
			names = append(names, name)
		}
	}
	return names
}

func (r Roster) team(id string) (Team, bool) {
	for _, t := range r.Teams {
		if t.ID == id {
			return t, true
		}
	}
	return Team{}, false
}

func (inc *Incident) teamOf(actor string) string {
	if a, ok := inc.coord.actors[actor]; ok && a.team != "" {
		return a.team
	}
	t, _ := inc.roster.teamOf(actor)
	return t.ID
}

func (inc *Incident) liveRoster() Roster {
	var r Roster
	for _, t := range inc.roster.Teams {
		t.Manager = inc.coord.team(t.ID).manager
		t.Members = slices.DeleteFunc(inc.teamPeople(t.ID), func(name string) bool { return name == t.Manager })
		r.Teams = append(r.Teams, t)
	}
	return r
}

func (inc *Incident) knownActors(logins []string, exclude string) []string {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	return inc.liveRoster().known(logins, exclude)
}

func (inc *Incident) teamPeople(id string) []string {
	var people []string
	if t, ok := inc.roster.team(id); ok {
		if t.Manager != "" {
			people = append(people, t.Manager)
		}
		people = append(people, t.Members...)
	}
	for _, name := range inc.coord.joinedIn(id) {
		if !slices.Contains(people, name) {
			people = append(people, name)
		}
	}
	return people
}

func (inc *Incident) members(team string, now time.Time) []MemberStatus {
	out := []MemberStatus{}
	for _, name := range inc.teamPeople(team) {
		out = append(out, MemberStatus{Actor: name, Status: inc.coord.status(name, now)})
	}
	return out
}

func (inc *Incident) people(now time.Time) map[string]Person {
	out := map[string]Person{}
	for _, t := range inc.roster.Teams {
		for _, name := range inc.teamPeople(t.ID) {
			out[name] = Person{Status: inc.coord.status(name, now), Team: inc.teamOf(name)}
		}
	}
	for name, a := range inc.coord.actors {
		if a.lastSeen.IsZero() {
			continue
		}
		seen := a.lastSeen
		out[name] = Person{Status: inc.coord.status(name, now), Team: a.team, LastSeen: &seen}
	}
	return out
}

func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		http.Error(w, "body must be JSON matching the P0 contract in docs/hackathon-plan.md", http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Debug("write response", "err", err)
	}
}

func (inc *Incident) handleJoin(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	var req struct {
		Actor string `json:"actor"`
		Team  string `json:"team"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Team == "" {
		t, _ := inc.roster.teamOf(req.Actor)
		req.Team = t.ID
	}
	rt, ok := inc.roster.team(req.Team)
	if req.Actor == "" || !ok {
		http.Error(w, "join needs an actor and a team from roster.yaml", http.StatusBadRequest)
		return
	}
	now := time.Now().UTC()

	inc.mu.Lock()
	c := &inc.coord
	a := c.actor(req.Actor)
	a.team, a.joined, a.lastSeen, a.status = req.Team, true, now, "online"
	tc := c.team(req.Team)
	text := "joined " + inc.id
	if tc.manager != req.Actor && c.status(tc.manager, now) != "online" {
		tc.manager, tc.election = req.Actor, nil
		tc.term++
		text = fmt.Sprintf("joined %s and manages %s, term %d", inc.id, rt.Name, tc.term)
	}
	resp := struct {
		Incident string         `json:"incident"`
		Team     string         `json:"team"`
		Manager  string         `json:"manager"`
		Term     int            `json:"term"`
		Members  []MemberStatus `json:"members"`
		Cursor   int            `json:"cursor"`
	}{inc.id, req.Team, tc.manager, tc.term, inc.members(req.Team, now), a.cursor}
	inc.mu.Unlock()

	inc.append(Event{Actor: req.Actor, Team: req.Team, Type: "join", Text: text, Term: resp.Term})
	writeJSON(w, resp)
}

func (inc *Incident) handleLeave(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	var req struct {
		Actor string `json:"actor"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	now := time.Now().UTC()

	inc.mu.Lock()
	c := &inc.coord
	a, ok := c.actors[req.Actor]
	if !ok || !a.joined {
		inc.mu.Unlock()
		http.Error(w, "actor has not joined "+inc.id, http.StatusNotFound)
		return
	}
	a.joined, a.status = false, "offline"
	var follow []Event
	if c.team(a.team).manager == req.Actor {
		follow = inc.startElection(a.team, now)
	}
	team := a.team
	inc.mu.Unlock()

	inc.append(Event{Actor: req.Actor, Team: team, Type: "leave", Text: "left " + inc.id})
	for _, ev := range follow {
		inc.append(ev)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (inc *Incident) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Actor string `json:"actor"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	inc.mu.Lock()
	a, ok := inc.coord.actors[req.Actor]
	if !ok || !a.joined {
		inc.mu.Unlock()
		http.Error(w, "join "+inc.id+" first", http.StatusNotFound)
		return
	}
	a.lastSeen = time.Now().UTC()
	changed := a.status != "online"
	a.status = "online"
	inc.mu.Unlock()
	if changed {
		inc.publishState()
	}
	w.WriteHeader(http.StatusNoContent)
}

func (inc *Incident) startElection(team string, now time.Time) []Event {
	c := &inc.coord
	tc := c.team(team)
	online := c.onlineIn(team, now)
	if len(online) == 0 {
		tc.manager, tc.election = "", nil
		return nil
	}
	candidate := online[0]
	for _, name := range online[1:] {
		if c.actors[name].cursor > c.actors[candidate].cursor {
			candidate = name
		}
	}
	tc.term++
	tc.election = &election{term: tc.term, candidate: candidate, votes: map[string]bool{}}
	rt, _ := inc.roster.team(team)
	gone := tc.manager
	if gone == "" {
		gone = "No manager"
	}
	return []Event{{
		Actor: candidate,
		Team:  team,
		Type:  "vote_request",
		To:    online,
		Term:  tc.term,
		Text:  fmt.Sprintf("%s asks for your vote as %s manager, term %d (cursor %d)", candidate, rt.Name, tc.term, c.actors[candidate].cursor),
		Why:   fmt.Sprintf("%s is offline; CaptainMorgue nominated %s, the online member who has seen the most of %s.", gone, candidate, inc.id),
	}}
}

func (inc *Incident) handleVote(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	var req struct {
		Actor     string `json:"actor"`
		Term      int    `json:"term"`
		Candidate string `json:"candidate"`
		Granted   bool   `json:"granted"`
	}
	if !decodeBody(w, r, &req) {
		return
	}

	inc.mu.Lock()
	team := inc.teamOf(req.Actor)
	tc := inc.coord.team(team)
	e := tc.election
	if e == nil || e.term != req.Term || (req.Candidate != "" && req.Candidate != e.candidate) {
		inc.mu.Unlock()
		http.Error(w, "no election open for that term and candidate", http.StatusConflict)
		return
	}
	e.votes[req.Actor] = req.Granted
	voters := []string{captainMorgue}
	for name, granted := range e.votes {
		if granted {
			voters = append(voters, name)
		}
	}
	slices.Sort(voters)
	rt, _ := inc.roster.team(team)
	size := 1 + len(rt.Members) + 1
	var result *Event
	if len(voters) >= size/2+1 {
		tc.manager, tc.election = e.candidate, nil
		result = &Event{
			Actor: captainMorgue,
			Team:  team,
			Type:  "election",
			To:    inc.coord.joinedIn(team),
			Term:  e.term,
			Text:  fmt.Sprintf("%s elected %s, term %d, %d of %d (%s)", rt.Name, e.candidate, e.term, len(voters), size, strings.Join(voters, ", ")),
			Why:   fmt.Sprintf("Majority of %s's %d voters, CaptainMorgue included.", rt.Name, size),
		}
	}
	inc.mu.Unlock()

	if result != nil {
		inc.append(*result)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (inc *Incident) watch(every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for now := range ticker.C {
		inc.mu.Lock()
		evs, changed := inc.tick(now.UTC())
		inc.mu.Unlock()
		for _, ev := range evs {
			inc.append(ev)
		}
		if changed && len(evs) == 0 {
			inc.publishState()
		}
	}
}

func (inc *Incident) tick(now time.Time) ([]Event, bool) {
	c := &inc.coord
	changed := false
	for name, a := range c.actors {
		if s := c.status(name, now); s != a.status {
			a.status, changed = s, true
		}
	}
	var evs []Event
	for _, t := range inc.roster.Teams {
		tc := c.team(t.ID)
		if c.status(tc.manager, now) != "offline" {
			continue
		}
		if e := tc.election; e != nil && c.status(e.candidate, now) != "offline" {
			continue
		}
		before := *tc
		evs = append(evs, inc.startElection(t.ID, now)...)
		changed = changed || before != *tc
	}
	return append(evs, inc.expireAsks(now)...), changed
}

func (inc *Incident) expireAsks(now time.Time) []Event {
	c := &inc.coord
	var evs []Event
	keep := c.pending[:0]
	for _, seq := range c.pending {
		ask := c.asks[seq]
		if now.Sub(ask.TS) < c.askTimeout {
			keep = append(keep, seq)
			continue
		}
		for _, to := range ask.To {
			if c.deliveries[seq][to] == "seen" {
				continue
			}
			evs = append(evs, Event{
				Actor:   captainMorgue,
				Type:    "autoreply",
				To:      []string{ask.Actor},
				ReplyTo: seq,
				Text:    fmt.Sprintf("%s has not seen your ask yet. %s", to, inc.latestFrom(to)),
				Why:     fmt.Sprintf("No ack from %s within %s.", to, c.askTimeout),
			})
			manager := c.team(inc.teamOf(to)).manager
			if manager == "" || manager == to || manager == ask.Actor {
				slog.Debug("no manager to escalate to", "ask", seq, "recipient", to)
				continue
			}
			evs = append(evs, Event{
				Actor:   captainMorgue,
				Type:    "escalation",
				To:      []string{manager},
				ReplyTo: seq,
				Text:    fmt.Sprintf("%s has not seen %s's ask for %s: %q", to, ask.Actor, c.askTimeout, ask.Text),
				Why:     fmt.Sprintf("You manage %s, who has not answered.", to),
			})
		}
	}
	c.pending = keep
	return evs
}

func (inc *Incident) latestFrom(actor string) string {
	for i := len(inc.events) - 1; i >= 0; i-- {
		if ev := inc.events[i]; ev.Actor == actor {
			return fmt.Sprintf("Latest from %s at %s: %s", actor, ev.TS.Format("15:04:05"), ev.Text)
		}
	}
	return actor + " has not posted anything in this incident yet."
}
