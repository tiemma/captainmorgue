package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"time"
)

type GraphNode struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	ParentID   string `json:"parent_id,omitempty"`
	ChildCount int    `json:"child_count"`
	Manager    string `json:"manager,omitempty"`
	Status     string `json:"status,omitempty"`
}

type GraphLink struct {
	A        string   `json:"a"`
	B        string   `json:"b"`
	Means    string   `json:"means"`
	Source   string   `json:"source"`
	Count    int      `json:"count"`
	Evidence []string `json:"evidence"`
}

type GraphWindow struct {
	Start *time.Time `json:"start"`
	End   *time.Time `json:"end"`
}

type Graph struct {
	Window GraphWindow `json:"window"`
	Nodes  []GraphNode `json:"nodes"`
	Links  []GraphLink `json:"links"`
}

var messageTypes = map[string]bool{"ask": true, "broadcast": true, "reply": true, "relay": true, "page": true}

const graphRoot = "org:" + captainMorgue

func teamNode(id string) string    { return "team:" + id }
func personNode(id string) string  { return "person:" + id }
func serviceNode(id string) string { return "service:" + id }

func parseWindow(r *http.Request) (GraphWindow, error) {
	var w GraphWindow
	for key, dst := range map[string]**time.Time{"start": &w.Start, "end": &w.End} {
		v := r.URL.Query().Get(key)
		if v == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return w, err
		}
		*dst = &t
	}
	return w, nil
}

func (w GraphWindow) contains(t time.Time) bool {
	return (w.Start == nil || !t.Before(*w.Start)) && (w.End == nil || !t.After(*w.End))
}

func (inc *Incident) graph(window GraphWindow, now time.Time) Graph {
	roster := inc.liveRoster()
	people := inc.people(now)
	inIncident := inc.teamsInIncident()

	owner := map[string]string{}
	for _, t := range roster.Teams {
		for _, s := range t.Owns {
			owner[s] = t.ID
		}
	}
	teamOf := func(ev Event) string {
		if ev.Team != "" {
			return ev.Team
		}
		return inc.teamOf(ev.Actor)
	}

	g := Graph{Window: window, Nodes: []GraphNode{}, Links: []GraphLink{}}
	g.Nodes = append(g.Nodes, GraphNode{ID: graphRoot, Kind: "org", Name: "CaptainMorgue", ChildCount: len(roster.Teams)})
	for _, t := range roster.Teams {
		if configured, ok := inc.roster.team(t.ID); ok && t.Manager == "" {
			t.Manager = configured.Manager
		}
		status := "standby"
		if inIncident[t.ID] {
			status = "pulled_in"
		}
		members := 0
		for _, p := range people {
			if p.Team == t.ID {
				members++
			}
		}
		g.Nodes = append(g.Nodes, GraphNode{ID: teamNode(t.ID), Kind: "team", Name: t.Name, ParentID: graphRoot,
			ChildCount: members + len(t.Owns), Manager: t.Manager, Status: status})
		g.Links = append(g.Links, GraphLink{A: teamNode(t.ID), B: graphRoot, Means: "part_of", Source: "configured", Count: 1, Evidence: []string{}})
		for _, s := range t.Owns {
			g.Nodes = append(g.Nodes, GraphNode{ID: serviceNode(s), Kind: "service", Name: s, ParentID: teamNode(t.ID)})
			g.Links = append(g.Links, GraphLink{A: teamNode(t.ID), B: serviceNode(s), Means: "owns", Source: "configured", Count: 1, Evidence: []string{"roster.yaml"}})
		}
		if t.Manager != "" {
			g.Links = append(g.Links, GraphLink{A: personNode(t.Manager), B: teamNode(t.ID), Means: "manages", Source: "configured", Count: 1, Evidence: []string{}})
		}
	}
	names := make([]string, 0, len(people))
	for name := range people {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		p := people[name]
		if p.Team == "" {
			continue
		}
		g.Nodes = append(g.Nodes, GraphNode{ID: personNode(name), Kind: "person", Name: name, ParentID: teamNode(p.Team), Status: p.Status})
		g.Links = append(g.Links, GraphLink{A: personNode(name), B: teamNode(p.Team), Means: "member_of", Source: "configured", Count: 1, Evidence: []string{}})
	}

	pairs := map[[3]string]*GraphLink{}
	add := func(a, b, means, source, evidence string) {
		if a == "" || b == "" || a == b {
			return
		}
		if means != "depends_on" && b < a {
			a, b = b, a
		}
		key := [3]string{a, b, means}
		l, ok := pairs[key]
		if !ok {
			l = &GraphLink{A: teamNode(a), B: teamNode(b), Means: means, Source: source, Evidence: []string{}}
			pairs[key] = l
		}
		l.Count++
		if len(l.Evidence) < 5 && !slices.Contains(l.Evidence, evidence) {
			l.Evidence = append(l.Evidence, evidence)
		}
	}
	for _, ev := range inc.events {
		if !window.contains(ev.TS) {
			continue
		}
		from := teamOf(ev)
		if messageTypes[ev.Type] {
			for _, to := range ev.To {
				add(from, inc.teamOf(to), "messaged", "observed", "event "+strconv.Itoa(ev.Seq))
			}
		}
		if ev.Resource != nil {
			add(from, owner[ev.Resource.Name], "depends_on", "inferred", "event "+strconv.Itoa(ev.Seq))
		}
	}
	var pulled []string
	for _, t := range roster.Teams {
		if inIncident[t.ID] {
			pulled = append(pulled, t.ID)
		}
	}
	for i := range pulled {
		for _, b := range pulled[i+1:] {
			add(pulled[i], b, "shared_incident", "observed", inc.id)
		}
	}
	keys := make([][3]string, 0, len(pairs))
	for k := range pairs {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return keys[i][2]+keys[i][0]+keys[i][1] < keys[j][2]+keys[j][0]+keys[j][1]
	})
	for _, k := range keys {
		g.Links = append(g.Links, *pairs[k])
	}
	return g
}

func (inc *Incident) handleGraph(w http.ResponseWriter, r *http.Request) {
	window, err := parseWindow(r)
	if err != nil {
		http.Error(w, "start and end must be RFC 3339 times", http.StatusBadRequest)
		return
	}
	inc.mu.Lock()
	g := inc.graph(window, time.Now().UTC())
	inc.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(g); err != nil {
		slog.Debug("write graph", "err", err)
	}
}
