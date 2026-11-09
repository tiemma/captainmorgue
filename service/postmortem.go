package main

import (
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
)

type CommandRun struct {
	Seq             int       `json:"seq"`
	TS              time.Time `json:"ts"`
	Actor           string    `json:"actor"`
	Team            string    `json:"team,omitempty"`
	Tool            string    `json:"tool"`
	Command         string    `json:"command"`
	Outcome         string    `json:"outcome"`
	ExitCode        *int      `json:"exit_code,omitempty"`
	DurationMS      int64     `json:"duration_ms,omitempty"`
	Cwd             string    `json:"cwd,omitempty"`
	Resource        *Resource `json:"resource,omitempty"`
	Changed         bool      `json:"changed"`
	LedToResolution bool      `json:"led_to_resolution"`
}

type Step struct {
	Seq       int        `json:"seq"`
	TS        time.Time  `json:"ts"`
	Actor     string     `json:"actor"`
	Team      string     `json:"team,omitempty"`
	Kind      string     `json:"kind"`
	Text      string     `json:"text"`
	Command   string     `json:"command,omitempty"`
	Outcome   string     `json:"outcome,omitempty"`
	Resource  *Resource  `json:"resource,omitempty"`
	Artifacts []Artifact `json:"artifacts,omitempty"`
}

type PostmortemPart struct {
	Name       string `json:"name"`
	Resolution string `json:"resolution"`
}

type PostmortemEvent struct {
	Time   string `json:"time"`
	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
}

type Postmortem struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Status       string            `json:"status"`
	Summary      string            `json:"summary"`
	Opened       *time.Time        `json:"opened,omitempty"`
	Resolved     *time.Time        `json:"resolved,omitempty"`
	FixedBy      string            `json:"fixed_by,omitempty"`
	Parts        []PostmortemPart  `json:"parts"`
	Improvements []Improvement     `json:"improvements"`
	Events       []PostmortemEvent `json:"events"`
	Steps        []Step            `json:"steps"`
	Commands     []CommandRun      `json:"commands"`
}

var toolText = regexp.MustCompile(`^(Checked: )?([A-Za-z][\w.-]*): (.+) \((ok|failed|interrupted)\)$`)

var stepKinds = map[string]string{
	"alert": "detected", "signal": "detected", "investigation": "investigated", "decision": "decided",
	"claim": "claimed", "conflict": "conflict", "ship": "shipped", "recovered": "recovered", "close": "resolved",
}

func commandOf(ev Event) (CommandRun, bool) {
	if ev.Type != "action" {
		return CommandRun{}, false
	}
	run := CommandRun{Seq: ev.Seq, TS: ev.TS, Actor: ev.Actor, Team: ev.Team, Tool: ev.Tool, Command: ev.Command,
		Outcome: ev.Outcome, ExitCode: ev.ExitCode, DurationMS: ev.DurationMS, Cwd: ev.Cwd, Resource: ev.Resource}
	read := false
	if m := toolText.FindStringSubmatch(ev.Text); m != nil {
		read = m[1] != ""
		if run.Tool == "" {
			run.Tool = m[2]
		}
		if run.Command == "" {
			run.Command = m[3]
		}
		if run.Outcome == "" {
			run.Outcome = m[4]
		}
	}
	if run.Command == "" {
		return CommandRun{}, false
	}
	if run.Outcome == "" && run.ExitCode != nil {
		run.Outcome = map[bool]string{true: "ok", false: "failed"}[*run.ExitCode == 0]
	}
	run.Changed = !read && !readOnly(run.Tool, run.Command)
	return run, true
}

func readOnly(tool, command string) bool {
	if tool == "Read" || tool == "Grep" || tool == "Glob" {
		return true
	}
	if tool != "Bash" && tool != "Shell" {
		return false
	}
	fields := strings.Fields(strings.ToLower(command))
	for i, f := range fields {
		if f == "kubectl" || f == "git" || f == "docker" || f == "helm" {
			if i+1 < len(fields) {
				return slices.Contains([]string{"get", "describe", "logs", "top", "status", "log", "diff", "show", "ps", "list", "history"}, fields[i+1])
			}
		}
	}
	first := ""
	if len(fields) > 0 {
		first = fields[0]
	}
	if first == "curl" {
		return !slices.ContainsFunc(fields, func(f string) bool {
			return f == "post" || f == "put" || f == "patch" || f == "delete" || strings.HasPrefix(f, "--data") || f == "-d"
		})
	}
	return slices.Contains([]string{"cat", "ls", "grep", "rg", "head", "tail", "less", "jq", "echo", "pwd", "which", "find"}, first)
}

func resolvedAt(events []Event) *time.Time {
	for i := len(events) - 1; i >= 0; i-- {
		if events[i].Type == "close" || events[i].Type == "recovered" {
			return &events[i].TS
		}
	}
	return nil
}

func recordings(events []Event) ([]Step, []CommandRun) {
	steps, commands := []Step{}, []CommandRun{}
	end := resolvedAt(events)
	for _, ev := range events {
		if run, ok := commandOf(ev); ok {
			run.LedToResolution = run.Changed && run.Outcome == "ok" && (end == nil || !run.TS.After(*end))
			commands = append(commands, run)
			if run.Changed {
				steps = append(steps, Step{Seq: ev.Seq, TS: ev.TS, Actor: ev.Actor, Team: ev.Team, Kind: "changed",
					Text: ev.Text, Command: run.Command, Outcome: run.Outcome, Resource: ev.Resource})
			}
			continue
		}
		kind, ok := stepKinds[ev.Type]
		if !ok && ev.Type == "action" {
			kind, ok = "acted", true
		}
		if !ok {
			continue
		}
		steps = append(steps, Step{Seq: ev.Seq, TS: ev.TS, Actor: ev.Actor, Team: ev.Team, Kind: kind, Text: ev.Text,
			Resource: ev.Resource, Artifacts: ev.Artifacts})
	}
	return steps, commands
}

func recordingSummary(title string, commands []CommandRun) string {
	changed := 0
	for _, c := range commands {
		if c.LedToResolution {
			changed++
		}
	}
	return fmt.Sprintf("%s. %s ran during the incident; %s changed the system on the way to the resolution.",
		title, countOf(len(commands), "command"), countOf(changed, "command"))
}

func (inc *Incident) postmortem() Postmortem {
	rec := inc.record()
	pm := Postmortem{ID: rec.ID, Title: rec.Title, Status: "open", Opened: rec.Opened, Resolved: rec.Resolved,
		Summary: recordingSummary(rec.Title, rec.Commands), Parts: []PostmortemPart{}, Improvements: rec.Improvements,
		Events: []PostmortemEvent{}, Steps: rec.Steps, Commands: rec.Commands}
	if rec.Resolved != nil {
		pm.Status = "resolved"
	}
	if inc.written != nil {
		pm.Summary, pm.FixedBy = inc.written.Summary, inc.written.FixedBy
	}
	for _, p := range rec.Parts {
		pm.Parts = append(pm.Parts, PostmortemPart{Name: p.Name, Resolution: p.How})
	}
	if pm.FixedBy == "" {
		var fixers []string
		for _, c := range rec.Commands {
			if c.LedToResolution && !slices.Contains(fixers, c.Actor) {
				fixers = append(fixers, c.Actor)
			}
		}
		pm.FixedBy = strings.Join(fixers, ", ")
	}
	for _, s := range rec.Steps {
		pm.Events = append(pm.Events, PostmortemEvent{Time: s.TS.Format("15:04"), Title: s.Text, Detail: s.Actor + " / " + s.Kind})
	}
	return pm
}

func (inc *Incident) handlePostmortems(w http.ResponseWriter, _ *http.Request) {
	inc.mu.Lock()
	defer inc.mu.Unlock()
	if len(inc.events) == 0 {
		writeJSON(w, []Postmortem{})
		return
	}
	writeJSON(w, []Postmortem{inc.postmortem()})
}

func (inc *Incident) handlePostmortem(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such postmortem", http.StatusNotFound)
		return
	}
	inc.mu.Lock()
	pm := inc.postmortem()
	inc.mu.Unlock()
	writeJSON(w, pm)
}
