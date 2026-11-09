package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	approvalExpiry = 5 * time.Minute
	approvalValid  = 10 * time.Minute
)

type Approval struct {
	ID        int        `json:"id"`
	Actor     string     `json:"actor"`
	Approver  string     `json:"approver"`
	Action    string     `json:"action"`
	Resource  *Resource  `json:"resource,omitempty"`
	Why       string     `json:"why"`
	Status    string     `json:"status"`
	Requested time.Time  `json:"requested"`
	Expires   time.Time  `json:"expires"`
	DecidedBy string     `json:"decided_by,omitempty"`
	Decided   *time.Time `json:"decided"`
	Note      string     `json:"note,omitempty"`
	Usable    bool       `json:"usable"`
}

func init() {
	envelopePriority["approval_request"] = "interrupt"
	envelopePriority["approval"] = "inject"
	trackedKinds["approval_request"] = true
	keyEvents["approval_request"] = true
	keyEvents["approval"] = true
}

func deniedApproval(ev Event) bool {
	return ev.Type == "approval" && strings.Contains(ev.Text, " denied approval ")
}

func (a Approval) at(now time.Time) Approval {
	if a.Status == "pending" && now.After(a.Expires) {
		a.Status = "expired"
	}
	a.Usable = a.Status == "approved" && now.Before(a.Decided.Add(approvalValid))
	return a
}

func (inc *Incident) approvalList(now time.Time) []Approval {
	out := make([]Approval, 0, len(inc.approvals))
	for _, a := range inc.approvals {
		out = append(out, a.at(now))
	}
	return out
}

func (inc *Incident) approverFor(actor string) string {
	if m := inc.coord.team(inc.teamOf(actor)).manager; m != "" && m != actor {
		return m
	}
	if c := inc.coord.commander; c != actor {
		return c
	}
	return ""
}

func (inc *Incident) handleApprovals(w http.ResponseWriter, _ *http.Request) {
	inc.mu.Lock()
	list := inc.approvalList(time.Now().UTC())
	inc.mu.Unlock()
	writeJSON(w, list)
}

func (inc *Incident) handleApprovalRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IncidentID string    `json:"incident_id"`
		Actor      string    `json:"actor"`
		Action     string    `json:"action"`
		Resource   *Resource `json:"resource"`
		Why        string    `json:"why"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.IncidentID != "" && req.IncidentID != inc.id {
		http.Error(w, "no such incident", http.StatusNotFound)
		return
	}
	if req.Actor == "" || req.Action == "" || req.Why == "" {
		http.Error(w, "approval needs an actor, an action and why", http.StatusBadRequest)
		return
	}
	now := time.Now().UTC()
	inc.mu.Lock()
	approver := inc.approverFor(req.Actor)
	if approver == "" {
		inc.mu.Unlock()
		http.Error(w, "nobody can approve this: your team has no other manager and there is no other commander", http.StatusConflict)
		return
	}
	a := Approval{
		ID: len(inc.approvals) + 1, Actor: req.Actor, Approver: approver, Action: req.Action, Resource: req.Resource,
		Why: req.Why, Status: "pending", Requested: now, Expires: now.Add(approvalExpiry),
	}
	inc.approvals = append(inc.approvals, a)
	term := inc.coord.team(inc.teamOf(req.Actor)).term
	inc.mu.Unlock()

	inc.append(Event{
		Actor: req.Actor, Type: "approval_request", Resource: req.Resource, To: []string{approver}, Term: term,
		Text: fmt.Sprintf("Approval %d: %s wants to run %q. Approve with cm approve %d, or cm deny %d <why>.", a.ID, req.Actor, req.Action, a.ID, a.ID),
		Why:  req.Why,
	})
	writeJSON(w, a)
}

func (inc *Incident) handleApprovalDecision(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "approval id must be a number", http.StatusBadRequest)
		return
	}
	var req struct {
		Actor    string `json:"actor"`
		Decision string `json:"decision"`
		Why      string `json:"why"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	status := map[string]string{"approve": "approved", "deny": "denied"}[req.Decision]
	if req.Actor == "" || status == "" {
		http.Error(w, "decision needs an actor and a decision of approve or deny", http.StatusBadRequest)
		return
	}
	now := time.Now().UTC()
	inc.mu.Lock()
	if id < 1 || id > len(inc.approvals) {
		inc.mu.Unlock()
		http.Error(w, "no such approval", http.StatusNotFound)
		return
	}
	a := &inc.approvals[id-1]
	if req.Actor != a.Approver && req.Actor != inc.coord.commander {
		inc.mu.Unlock()
		http.Error(w, fmt.Sprintf("only %s or the commander can decide approval %d", a.Approver, id), http.StatusForbidden)
		return
	}
	if current := a.at(now).Status; current != "pending" {
		inc.mu.Unlock()
		http.Error(w, fmt.Sprintf("approval %d is already %s", id, current), http.StatusConflict)
		return
	}
	a.Status, a.DecidedBy, a.Decided, a.Note = status, req.Actor, &now, req.Why
	decided := a.at(now)
	inc.mu.Unlock()

	inc.append(Event{
		Actor: req.Actor, Type: "approval", Resource: decided.Resource, To: []string{decided.Actor},
		Text: fmt.Sprintf("%s %s approval %d: %q. %s", req.Actor, status, id, decided.Action, map[string]string{
			"approved": "Retry it now; the approval holds for 10 minutes.",
			"denied":   "Do not run it.",
		}[status]),
		Why: req.Why,
	})
	writeJSON(w, decided)
}
