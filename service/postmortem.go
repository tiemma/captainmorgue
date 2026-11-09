package main

import (
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

var toolText = regexp.MustCompile(`^(Checked: )?([A-Za-z][\w.-]*): (.+) \((ok|failed|interrupted)\)$`)

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

func commandRuns(events []Event) []CommandRun {
	commands := []CommandRun{}
	end := resolvedAt(events)
	for _, ev := range events {
		if run, ok := commandOf(ev); ok {
			run.LedToResolution = run.Changed && run.Outcome == "ok" && (end == nil || !run.TS.After(*end))
			commands = append(commands, run)
		}
	}
	return commands
}
