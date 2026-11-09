package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCommandOfReadsStructuredAndLegacyText(t *testing.T) {
	zero, one := 0, 1
	cases := []struct {
		ev                 Event
		tool, cmd, outcome string
		changed, isCommand bool
	}{
		{Event{Type: "action", Tool: "Bash", Command: "kubectl rollout undo deploy/checkin", Outcome: "ok"}, "Bash", "kubectl rollout undo deploy/checkin", "ok", true, true},
		{Event{Type: "action", Text: "Bash: kubectl get pods -n conference (ok)"}, "Bash", "kubectl get pods -n conference", "ok", false, true},
		{Event{Type: "action", Text: "Checked: mcp__radar__get_resource: Deployment/confdb (ok)"}, "mcp__radar__get_resource", "Deployment/confdb", "ok", false, true},
		{Event{Type: "action", Text: "Shell: kubectl scale deploy/checkin --replicas=6 (failed)", ExitCode: &one}, "Shell", "kubectl scale deploy/checkin --replicas=6", "failed", true, true},
		{Event{Type: "action", Tool: "Shell", Command: "curl -X POST https://example.com/flush", ExitCode: &zero}, "Shell", "curl -X POST https://example.com/flush", "ok", true, true},
		{Event{Type: "action", Text: "Working on: drain confdb"}, "", "", "", false, false},
		{Event{Type: "decision", Text: "Bash: kubectl delete pod x (ok)"}, "", "", "", false, false},
	}
	for _, c := range cases {
		run, ok := commandOf(c.ev)
		if ok != c.isCommand {
			t.Fatalf("%q: command = %v, want %v", c.ev.Text+c.ev.Command, ok, c.isCommand)
		}
		if !ok {
			continue
		}
		if run.Tool != c.tool || run.Command != c.cmd || run.Outcome != c.outcome || run.Changed != c.changed {
			t.Errorf("%q: got %+v", c.ev.Text+c.ev.Command, run)
		}
	}
}

func TestPostmortemRecordsStepsAndResolvingCommands(t *testing.T) {
	inc := newIncident("INC-7", "Check-in down", Roster{Teams: []Team{{ID: "registration", Name: "Registration", Manager: "emmanuel"}}}, nil, nil)
	if err := inc.startCoord(); err != nil {
		t.Fatal(err)
	}
	ts := time.Date(2026, 11, 9, 14, 41, 0, 0, time.UTC)
	for i, ev := range []Event{
		{Actor: "dash0", Type: "alert", Text: "checkin p95 above 4s"},
		{Actor: "emmanuel", Type: "action", Text: "Bash: kubectl get pods -n conference (ok)"},
		{Actor: "emmanuel", Type: "investigation", Text: "Canary v1.8 added an unindexed lookup"},
		{Actor: "emmanuel", Type: "action", Tool: "Bash", Command: "kubectl rollout undo deploy/checkin", Outcome: "failed"},
		{Actor: "emmanuel", Type: "action", Tool: "Bash", Command: "kubectl rollout undo deploy/checkin -n conference", Outcome: "ok", Resource: &Resource{Kind: "Deployment", Name: "checkin"}},
		{Actor: "emmanuel", Type: "join", Text: "joined"},
		{Actor: "emmanuel", Type: "close", Text: "Recovered after rollback"},
		{Actor: "emmanuel", Type: "action", Tool: "Bash", Command: "kubectl annotate deploy/checkin note=after", Outcome: "ok"},
	} {
		ev.TS = ts.Add(time.Duration(i) * time.Minute)
		inc.append(ev)
	}

	rec := httptest.NewRecorder()
	inc.handlePostmortem(rec, func() *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/postmortems/INC-7", nil)
		r.SetPathValue("id", "INC-7")
		return r
	}())
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var pm Postmortem
	if err := json.NewDecoder(rec.Body).Decode(&pm); err != nil {
		t.Fatal(err)
	}
	if pm.Status != "resolved" || len(pm.Commands) != 4 {
		t.Fatalf("status %q, %d commands", pm.Status, len(pm.Commands))
	}
	var resolving []string
	for _, c := range pm.Commands {
		if c.LedToResolution {
			resolving = append(resolving, c.Command)
		}
	}
	if len(resolving) != 1 || resolving[0] != "kubectl rollout undo deploy/checkin -n conference" {
		t.Fatalf("resolving commands %v", resolving)
	}
	if pm.FixedBy != "emmanuel" {
		t.Fatalf("fixed_by %q", pm.FixedBy)
	}
	kinds := []string{}
	for _, s := range pm.Steps {
		kinds = append(kinds, s.Kind)
	}
	want := []string{"detected", "investigated", "changed", "changed", "resolved", "changed"}
	if len(kinds) != len(want) {
		t.Fatalf("steps %v, want %v", kinds, want)
	}
	for i := range want {
		if kinds[i] != want[i] {
			t.Fatalf("steps %v, want %v", kinds, want)
		}
	}

	missing := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/postmortems/nope", nil)
	r.SetPathValue("id", "nope")
	inc.handlePostmortem(missing, r)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing status %d", missing.Code)
	}
}
