package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func graphIncident(t *testing.T) *Incident {
	t.Helper()
	roster := Roster{Teams: []Team{
		{ID: "registration", Name: "Registration", Manager: "emmanuel", Owns: []string{"checkin"}},
		{ID: "platform", Name: "Platform", Manager: "sammy", Owns: []string{"confdb"}},
		{ID: "ticketing", Name: "Ticketing", Manager: "jubril", Owns: []string{"payments"}},
	}}
	inc := newIncident("INC-1", "Graph", roster, nil, nil)
	if err := inc.startCoord(); err != nil {
		t.Fatal(err)
	}
	ts := time.Date(2026, 11, 9, 14, 41, 0, 0, time.UTC)
	for i, ev := range []Event{
		{Actor: "emmanuel", Type: "investigation", Text: "slow check-in"},
		{Actor: "emmanuel", Type: "ask", Text: "confdb?", To: []string{"sammy"}},
		{Actor: "sammy", Type: "reply", Text: "draining", To: []string{"emmanuel"}},
		{Actor: "emmanuel", Type: "claim", Text: "restart", Resource: &Resource{Kind: "Deployment", Name: "confdb"}},
		{Actor: "sammy", Type: "join", Text: "joined", To: []string{"emmanuel"}},
	} {
		ev.TS = ts.Add(time.Duration(i) * time.Minute)
		inc.append(ev)
	}
	return inc
}

func findLink(g Graph, a, b, means string) *GraphLink {
	for i, l := range g.Links {
		if l.A == a && l.B == b && l.Means == means {
			return &g.Links[i]
		}
	}
	return nil
}

func TestGraphBuildsTreeAndTeamArcs(t *testing.T) {
	inc := graphIncident(t)
	inc.mu.Lock()
	g := inc.graph(GraphWindow{}, time.Now().UTC())
	inc.mu.Unlock()

	kinds := map[string]int{}
	for _, n := range g.Nodes {
		kinds[n.Kind]++
	}
	if kinds["org"] != 1 || kinds["team"] != 3 || kinds["service"] != 3 {
		t.Fatalf("unexpected nodes %v", kinds)
	}
	if findLink(g, teamNode("registration"), serviceNode("checkin"), "owns") == nil {
		t.Fatal("missing owns link")
	}
	if findLink(g, personNode("sammy"), teamNode("platform"), "manages") == nil {
		t.Fatal("missing manages link")
	}
	msg := findLink(g, teamNode("platform"), teamNode("registration"), "messaged")
	if msg == nil || msg.Count != 2 {
		t.Fatalf("messaged link = %+v, want count 2 (join notices are not messages)", msg)
	}
	dep := findLink(g, teamNode("registration"), teamNode("platform"), "depends_on")
	if dep == nil || dep.Source != "inferred" || dep.Count != 1 {
		t.Fatalf("depends_on link = %+v", dep)
	}
	shared := findLink(g, teamNode("platform"), teamNode("registration"), "shared_incident")
	if shared == nil || shared.Evidence[0] != "INC-1" {
		t.Fatalf("shared_incident link = %+v", shared)
	}
	if findLink(g, teamNode("registration"), teamNode("ticketing"), "shared_incident") != nil {
		t.Fatal("ticketing was never pulled in")
	}
}

func TestGraphWindowAndHandler(t *testing.T) {
	inc := graphIncident(t)
	rec := httptest.NewRecorder()
	inc.handleGraph(rec, httptest.NewRequest(http.MethodGet, "/api/graph?end=2026-11-09T14:41:30Z", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var g Graph
	if err := json.NewDecoder(rec.Body).Decode(&g); err != nil {
		t.Fatal(err)
	}
	if findLink(g, teamNode("platform"), teamNode("registration"), "messaged") != nil {
		t.Fatal("window should exclude the ask at 14:42")
	}
	bad := httptest.NewRecorder()
	inc.handleGraph(bad, httptest.NewRequest(http.MethodGet, "/api/graph?start=yesterday", nil))
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("bad window status %d", bad.Code)
	}
}
