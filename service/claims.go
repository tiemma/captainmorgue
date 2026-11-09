package main

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
)

const claimLease = 5 * time.Minute

type Claim struct {
	Key     string    `json:"key"`
	Actor   string    `json:"actor"`
	Text    string    `json:"text"`
	Since   time.Time `json:"since"`
	Expires time.Time `json:"expires"`
}

func claimKey(r Resource) string {
	return r.Namespace + "/" + strings.ToLower(r.Kind) + "/" + r.Name
}

func (inc *Incident) activeClaim(key string, now time.Time) (*Claim, bool) {
	c, ok := inc.claims[key]
	if !ok || now.After(c.Expires) || inc.coord.status(c.Actor, now) == "offline" {
		return nil, false
	}
	return c, true
}

func (inc *Incident) activeClaims(now time.Time) []Claim {
	out := []Claim{}
	for key := range inc.claims {
		if c, ok := inc.activeClaim(key, now); ok {
			out = append(out, *c)
		}
	}
	slices.SortFunc(out, func(a, b Claim) int { return a.Since.Compare(b.Since) })
	return out
}

func ago(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds ago", int(d.Seconds()))
	}
	return fmt.Sprintf("%dm ago", int(d.Minutes()))
}

func (inc *Incident) handleClaim(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Actor    string   `json:"actor"`
		Text     string   `json:"text"`
		Resource Resource `json:"resource"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Actor == "" || req.Resource.Kind == "" || req.Resource.Name == "" {
		http.Error(w, "claim needs an actor and a resource with kind and name", http.StatusBadRequest)
		return
	}
	now := time.Now().UTC()
	key := claimKey(req.Resource)

	inc.mu.Lock()
	if inc.claims == nil {
		inc.claims = map[string]*Claim{}
	}
	held, ok := inc.activeClaim(key, now)
	if ok && held.Actor != req.Actor {
		term := inc.coord.team(inc.teamOf(held.Actor)).term
		holder := *held
		inc.mu.Unlock()
		reason := fmt.Sprintf("%s (%s) is held by %s (%s, term %d, %s). Ask them first: /captainmorgue:ask @%s ...",
			req.Resource.Name, key, holder.Actor, holder.Text, term, ago(now.Sub(holder.Since)), holder.Actor)
		inc.append(Event{
			Actor:    captainMorgue,
			Type:     "conflict",
			Text:     fmt.Sprintf("%s tried to %s %s and was blocked because you hold it (%s).", req.Actor, req.Text, key, holder.Text),
			Resource: &req.Resource,
			To:       []string{holder.Actor},
			Why:      fmt.Sprintf("%s holds the claim on %s until %s.", holder.Actor, key, holder.Expires.Format("15:04:05")),
			Term:     term,
		})
		writeJSON(w, map[string]any{"granted": false, "key": key, "holder": holder.Actor, "reason": reason})
		return
	}
	renewal := ok
	if !renewal {
		held = &Claim{Key: key, Actor: req.Actor, Since: now}
		inc.claims[key] = held
	}
	held.Text, held.Expires = req.Text, now.Add(claimLease)
	inc.mu.Unlock()

	if !renewal {
		inc.append(Event{Actor: req.Actor, Type: "claim", Text: fmt.Sprintf("claimed %s to %s", key, req.Text), Resource: &req.Resource})
	}
	writeJSON(w, map[string]any{"granted": true, "key": key, "holder": req.Actor})
}
