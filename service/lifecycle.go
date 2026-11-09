package main

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
)

var lifecycle = []string{"open", "investigating", "mitigated", "resolved", "closed"}

var severities = map[string]bool{"sev1": true, "sev2": true, "sev3": true}

var dueBySeverity = map[string]string{"sev1": "within 2 days", "sev2": "within 1 week", "sev3": "within 2 weeks", "": "within 2 weeks"}

var keyEvents = map[string]bool{
	"alert": true, "page": true, "recovered": true, "signal": true, "status": true, "close": true,
	"conflict": true, "escalation": true, "election": true, "investigation": true, "decision": true,
	"note": true, "ship": true, "pr": true, "action_item": true,
}

type Moment struct {
	TS    time.Time `json:"ts"`
	Actor string    `json:"actor"`
	Type  string    `json:"type"`
	Text  string    `json:"text"`
}

type Step struct {
	TS         time.Time `json:"ts"`
	Actor      string    `json:"actor"`
	Text       string    `json:"text"`
	Status     string    `json:"status"`
	Resource   string    `json:"resource,omitempty"`
	ExitCode   *int      `json:"exit_code,omitempty"`
	DurationMS int64     `json:"duration_ms,omitempty"`
	Failed     bool      `json:"failed"`
	Change     bool      `json:"change"`
}

type StepGroup struct {
	Actor string `json:"actor"`
	Steps []Step `json:"steps"`
}

type PR struct {
	Service string    `json:"service"`
	URL     string    `json:"url"`
	Author  string    `json:"author"`
	TS      time.Time `json:"ts"`
}

type Window struct {
	Opened     *time.Time `json:"opened"`
	Detected   *time.Time `json:"detected"`
	Mitigated  *time.Time `json:"mitigated"`
	Resolved   *time.Time `json:"resolved"`
	Closed     *time.Time `json:"closed"`
	ToMitigate string     `json:"to_mitigate"`
	ToResolve  string     `json:"to_resolve"`
	Duration   string     `json:"duration"`
}

func eventStatus(ev Event) string {
	switch ev.Type {
	case "open":
		return "open"
	case "close":
		return "closed"
	}
	if ev.Part != "" {
		return ""
	}
	return ev.Status
}

func (inc *Incident) lifecycleStatus() (status, severity string) {
	status = "open"
	for _, ev := range inc.events {
		if ev.Type == "open" {
			severity = ""
		}
		if s := eventStatus(ev); s != "" {
			status = s
		}
		if ev.Severity != "" {
			severity = ev.Severity
		}
	}
	return status, severity
}

func (inc *Incident) mayResolve(actor string) bool {
	c := &inc.coord
	if c.commander != "" {
		return c.commander == actor
	}
	for _, tc := range c.teams {
		if tc.manager == actor {
			return true
		}
	}
	return false
}

func (inc *Incident) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	var req struct {
		Actor    string `json:"actor"`
		Status   string `json:"status"`
		Severity string `json:"severity"`
		Why      string `json:"why"`
		Part     string `json:"part"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Actor == "" || (req.Status == "" && req.Severity == "") {
		http.Error(w, "status needs an actor and a status or severity", http.StatusBadRequest)
		return
	}
	if req.Severity != "" && !severities[req.Severity] {
		http.Error(w, "severity must be sev1, sev2 or sev3", http.StatusBadRequest)
		return
	}
	to := slices.Index(lifecycle, req.Status)
	if req.Status != "" && to < 0 {
		http.Error(w, "status must be one of "+strings.Join(lifecycle, ", "), http.StatusBadRequest)
		return
	}

	inc.mu.Lock()
	current, severity := inc.lifecycleStatus()
	allowed := inc.mayResolve(req.Actor)
	inc.mu.Unlock()
	if current == "closed" {
		http.Error(w, inc.id+" is closed", http.StatusConflict)
		return
	}
	if req.Part != "" {
		if req.Status != "mitigated" && req.Status != "resolved" {
			http.Error(w, "a part moves to mitigated or resolved", http.StatusBadRequest)
			return
		}
		text := "marked " + req.Part + " " + req.Status
		if req.Why != "" {
			text += ": " + req.Why
		}
		inc.append(Event{Actor: req.Actor, Type: "status", Status: req.Status, Part: req.Part, Why: req.Why, Text: text})
		writeJSON(w, map[string]string{"status": current, "severity": severity})
		return
	}
	switch {
	case req.Status != "" && to <= slices.Index(lifecycle, current):
		http.Error(w, fmt.Sprintf("%s is already %s; it only moves forward", inc.id, current), http.StatusConflict)
		return
	case to >= slices.Index(lifecycle, "resolved") && !allowed:
		http.Error(w, "only the commander, or a team manager when there is no commander, can move "+inc.id+" to "+req.Status, http.StatusForbidden)
		return
	}

	ev := Event{Actor: req.Actor, Type: "status", Status: req.Status, Severity: req.Severity, Why: req.Why}
	var said []string
	if req.Status != "" {
		said = append(said, "moved "+inc.id+" to "+req.Status)
		current = req.Status
	}
	if req.Severity != "" {
		said = append(said, "set severity "+req.Severity)
		severity = req.Severity
	}
	ev.Text = strings.Join(said, ", ")
	if req.Why != "" {
		ev.Text += ": " + req.Why
	}
	if req.Status == "closed" {
		ev.Type, ev.Status, ev.Why = "close", "", ""
		ev.Text = req.Why
		if ev.Text == "" {
			ev.Text = "closed " + inc.id
		}
	}
	if inc.append(ev).Seq == 0 {
		http.Error(w, inc.id+" is closed", http.StatusConflict)
		return
	}
	writeJSON(w, map[string]string{"status": current, "severity": severity})
}

func (inc *Incident) prs() []PR {
	out := []PR{}
	for _, ev := range inc.events {
		if ev.Type == "pr" && ev.Resource != nil && len(ev.Artifacts) > 0 {
			out = append(out, PR{Service: ev.Resource.Name, URL: ev.Artifacts[0].URL, Author: ev.Actor, TS: ev.TS})
		}
	}
	return out
}

func minutes(from, to *time.Time) string {
	if from == nil || to == nil {
		return ""
	}
	return fmt.Sprintf("%d min", int(to.Sub(*from).Minutes()))
}

func window(events []Event) Window {
	var w Window
	reached := func(at **time.Time, ev *Event, status string) {
		if *at == nil && slices.Index(lifecycle, eventStatus(*ev)) >= slices.Index(lifecycle, status) {
			*at = &ev.TS
		}
	}
	for i := range events {
		ev := &events[i]
		if w.Opened == nil || ev.Type == "open" {
			w = Window{Opened: &ev.TS}
		}
		if w.Detected == nil && (ev.Type == "alert" || ev.Type == "page" || ev.Type == "signal") {
			w.Detected = &ev.TS
		}
		reached(&w.Mitigated, ev, "mitigated")
		reached(&w.Resolved, ev, "resolved")
		reached(&w.Closed, ev, "closed")
	}
	if w.Detected == nil {
		w.Detected = w.Opened
	}
	w.ToMitigate = minutes(w.Detected, w.Mitigated)
	w.ToResolve = minutes(w.Detected, w.Resolved)
	w.Duration = minutes(w.Opened, w.Resolved)
	return w
}

func actionStatus(text string) string {
	for _, st := range []string{"ok", "failed", "interrupted"} {
		if strings.HasSuffix(text, "("+st+")") {
			return st
		}
	}
	return ""
}

func failedAction(ev Event) bool {
	if ev.Type != "action" {
		return false
	}
	st := actionStatus(ev.Text)
	return st == "failed" || st == "interrupted" || (ev.ExitCode != nil && *ev.ExitCode != 0)
}

func steps(events []Event) (groups []StepGroup, changes []Step) {
	groups, changes = []StepGroup{}, []Step{}
	for _, ev := range events {
		if ev.Type != "action" || ev.Actor == captainMorgue {
			continue
		}
		st := Step{
			TS: ev.TS, Actor: ev.Actor, Text: strings.TrimSuffix(ev.Text, " ("+actionStatus(ev.Text)+")"), Status: actionStatus(ev.Text),
			ExitCode: ev.ExitCode, DurationMS: ev.DurationMS, Failed: failedAction(ev), Change: ev.Resource != nil && looksLikeWrite(ev),
		}
		if ev.Resource != nil {
			st.Resource = resourceLabel(ev.Resource)
		}
		if st.Change {
			changes = append(changes, st)
		}
		if n := len(groups); n > 0 && groups[n-1].Actor == ev.Actor {
			groups[n-1].Steps = append(groups[n-1].Steps, st)
			continue
		}
		groups = append(groups, StepGroup{Actor: ev.Actor, Steps: []Step{st}})
	}
	return groups, changes
}

func (st Step) line() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s", st.TS.UTC().Format(time.RFC3339), st.Text)
	var tags []string
	if st.Failed {
		tags = append(tags, "FAILED")
	} else if st.Status != "" {
		tags = append(tags, st.Status)
	}
	if st.ExitCode != nil {
		tags = append(tags, fmt.Sprintf("exit %d", *st.ExitCode))
	}
	if st.DurationMS > 0 {
		tags = append(tags, fmt.Sprintf("%d ms", st.DurationMS))
	}
	if st.Resource != "" {
		tags = append(tags, "on "+st.Resource)
	}
	if len(tags) > 0 {
		fmt.Fprintf(&b, " (%s)", strings.Join(tags, ", "))
	}
	return b.String()
}

func moments(events []Event, keep func(Event) bool) []Moment {
	out := []Moment{}
	for _, ev := range events {
		if keep(ev) {
			out = append(out, Moment{TS: ev.TS, Actor: ev.Actor, Type: ev.Type, Text: ev.Text})
		}
	}
	return out
}

func incidentErrors(events []Event) []Moment {
	return moments(events, func(ev Event) bool {
		switch ev.Type {
		case "alert", "page", "signal", "conflict", "escalation":
			return true
		case "approval":
			return strings.Contains(ev.Text, " denied approval ")
		}
		return failedAction(ev)
	})
}

func firstURL(text string) string {
	for _, f := range strings.Fields(text) {
		if strings.HasPrefix(f, "https://") || strings.HasPrefix(f, "http://") {
			return f
		}
	}
	return ""
}

func explicitActionItems(events []Event, severity string) []Improvement {
	out := []Improvement{}
	for _, ev := range events {
		if ev.Type != "action_item" || len(ev.To) == 0 {
			continue
		}
		out = append(out, Improvement{Text: ev.Text, Owner: ev.To[0], Link: firstURL(ev.Text), Due: dueBySeverity[severity]})
	}
	return out
}

func fallbackRecord(title string, events []Event) writtenRecord {
	w := writtenRecord{Parts: []RecordPart{}, Improvements: []Improvement{}, ContributingFactors: []string{}}
	count := map[string]int{}
	claimBlocks, failed := 0, 0
	var closeText, finding, fixer string
	for _, ev := range events {
		count[ev.Type]++
		switch ev.Type {
		case "close":
			closeText = ev.Text
		case "investigation", "note":
			finding = ev.Text
		case "ship", "pr":
			fixer = ev.Actor
		case "alert", "page":
			w.ContributingFactors = append(w.ContributingFactors, "Alert from "+ev.Actor+": "+ev.Text)
		case "conflict":
			if ev.Term > 0 {
				claimBlocks++
			} else if ev.Resource != nil {
				w.ContributingFactors = append(w.ContributingFactors, "Two responders acted on "+resourceLabel(ev.Resource)+" at the same time")
			}
		}
		if failedAction(ev) {
			failed++
		}
	}
	w.RootCause = finding
	if w.RootCause == "" {
		w.RootCause = "Not recorded during the incident."
	}
	w.Summary = closeText
	if w.Summary == "" || w.Summary == "closed" {
		w.Summary = title + ". " + w.RootCause
	}
	w.FixedBy = fixer
	add := func(list *[]string, n int, format string) {
		if n > 0 {
			*list = append(*list, fmt.Sprintf(format, n))
		}
	}
	if win := window(events); win.ToMitigate != "" {
		w.WentWell = append(w.WentWell, "Mitigated "+win.ToMitigate+" after detection")
	}
	add(&w.WentWell, count["conflict"]-claimBlocks, "Conflicting actions caught and flagged to both people: %d")
	add(&w.WentWell, claimBlocks, "Writes blocked by a claim before they collided: %d")
	add(&w.WentWell, count["autoreply"], "Auto-replies telling askers what a busy responder was doing: %d")
	add(&w.WentWell, count["approval_request"], "Destructive actions held for a manager's approval: %d")
	add(&w.WentWell, count["election"], "Elections that kept every team managed: %d")
	add(&w.WentWell, count["reply"], "Asks answered: %d")
	add(&w.WentWell, count["pr"], "Fixes opened as pull requests: %d")
	add(&w.WentBadly, count["escalation"], "Asks that went unanswered and were escalated to a manager: %d")
	add(&w.WentBadly, count["vote_request"], "Times a team manager went silent: %d")
	add(&w.WentBadly, failed, "Failed actions: %d")
	add(&w.WentBadly, count["alert"]+count["page"], "Alerts fired: %d")
	if len(w.WentWell) == 0 {
		w.WentWell = []string{"Nothing stood out."}
	}
	if len(w.WentBadly) == 0 {
		w.WentBadly = []string{"Nothing stood out."}
	}
	return w
}

func (rec Record) markdown() string {
	var b strings.Builder
	line := func(format string, a ...any) { fmt.Fprintf(&b, format+"\n", a...) }
	when := func(t *time.Time) string {
		if t == nil {
			return "-"
		}
		return t.UTC().Format("15:04:05 UTC")
	}
	list := func(heading string, items []string) {
		line("\n## %s\n", heading)
		if len(items) == 0 {
			line("- none")
		}
		for _, it := range items {
			line("- %s", it)
		}
	}
	momentLines := func(ms []Moment) []string {
		var out []string
		for _, m := range ms {
			out = append(out, fmt.Sprintf("%s %s [%s]: %s", m.TS.UTC().Format("15:04:05"), m.Actor, m.Type, m.Text))
		}
		return out
	}
	severity := rec.Severity
	if severity == "" {
		severity = "not set"
	}
	line("# Reason For Outage: %s %s\n", rec.ID, rec.Title)
	line("Severity: %s. Status: %s. Written by: %s.\n", severity, rec.Status, rec.WrittenBy)
	line("%s", rec.Summary)
	w := rec.Window
	line("\n## Impact window\n")
	line("| Opened | Detected | Mitigated | Resolved | Closed | To mitigate | To resolve | Duration |")
	line("|---|---|---|---|---|---|---|---|")
	line("| %s | %s | %s | %s | %s | %s | %s | %s |", when(w.Opened), when(w.Detected), when(w.Mitigated), when(w.Resolved), when(w.Closed), w.ToMitigate, w.ToResolve, w.Duration)
	line("\n## Root cause\n")
	line("%s", rec.RootCause)
	list("Contributing factors", rec.ContributingFactors)
	list("Timeline", momentLines(rec.Timeline))
	list("What went well", rec.WentWell)
	list("What went badly", rec.WentBadly)
	list("Errors during the incident", momentLines(rec.Errors))
	var prs []string
	for _, p := range rec.Remediation {
		prs = append(prs, fmt.Sprintf("%s: %s (by %s)", p.Service, p.URL, p.Author))
	}
	list("Remediation", prs)
	var items []string
	for _, a := range rec.ActionItems {
		item := fmt.Sprintf("@%s: %s (due %s)", a.Owner, a.Text, a.Due)
		if a.Link != "" && !strings.Contains(a.Text, a.Link) {
			item += " " + a.Link
		}
		items = append(items, item)
	}
	list("Action items", items)
	var changes []string
	for _, st := range rec.Changes {
		changes = append(changes, st.Actor+": "+st.line())
	}
	line("\n## Appendix: steps taken")
	list("Changes made", changes)
	for _, g := range rec.Steps {
		var lines []string
		for _, st := range g.Steps {
			lines = append(lines, st.line())
		}
		list(g.Actor, lines)
	}
	return b.String()
}

func (inc *Incident) deliverActionItems(rec Record) {
	var owners []string
	byOwner := map[string][]string{}
	for _, a := range rec.ActionItems {
		if a.Owner == "" {
			continue
		}
		if _, ok := byOwner[a.Owner]; !ok {
			owners = append(owners, a.Owner)
		}
		byOwner[a.Owner] = append(byOwner[a.Owner], fmt.Sprintf("- %s (due %s)", a.Text, a.Due))
	}
	for _, owner := range owners {
		inc.append(Event{
			Actor: captainMorgue,
			Type:  "action",
			To:    []string{owner},
			Text:  "Action items for you from the " + inc.id + " RFO:\n" + strings.Join(byOwner[owner], "\n"),
			Why:   "You own these follow-ups in the " + inc.id + " RFO.",
		})
	}
}
