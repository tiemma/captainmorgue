package main

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
)

const (
	digestTimeout = 8 * time.Second
	digestBehind  = 10
	digestRecent  = 3
	digestLines   = 6
)

var returnThreshold = map[string]int{"offline": 0, "suspect": digestBehind}

var notActions = map[string]bool{"join": true, "leave": true, "election": true}

func (inc *Incident) unseenBy(actor string, since int) []Event {
	var out []Event
	for _, ev := range inc.events[min(since, len(inc.events)):] {
		if ev.Actor != actor && ev.Type != "digest" && ev.Type != "vote_request" {
			out = append(out, ev)
		}
	}
	return out
}

func (inc *Incident) digestDue(a *actorState, actor string, threshold int) (int, bool) {
	since := max(a.cursor, a.digested)
	if len(inc.unseenBy(actor, since)) <= threshold {
		return 0, false
	}
	a.digested = len(inc.events)
	return since, true
}

func (inc *Incident) teamsText() string {
	var parts []string
	for _, t := range inc.roster.Teams {
		people := inc.coord.joinedIn(t.ID)
		if len(people) == 0 {
			continue
		}
		manager := inc.coord.team(t.ID).manager
		if manager == "" {
			manager = "nobody"
		}
		parts = append(parts, fmt.Sprintf("%s managed by %s (%s)", t.Name, manager, strings.Join(people, ", ")))
	}
	return strings.Join(parts, "; ")
}

func (inc *Incident) unansweredAsks(actor string, unseen []Event) []Event {
	var out []Event
	for _, ev := range unseen {
		if ev.Type != "ask" || !slices.Contains(ev.To, actor) {
			continue
		}
		answered := slices.ContainsFunc(inc.events, func(r Event) bool {
			return r.Type == "reply" && r.ReplyTo == ev.Seq && r.Actor == actor
		})
		if !answered {
			out = append(out, ev)
		}
	}
	return out
}

func quoted(evs []Event) string {
	parts := make([]string, len(evs))
	for i, ev := range evs {
		parts[i] = fmt.Sprintf("%s %s (seq %d) %q", ev.Actor, ev.Type, ev.Seq, ev.Text)
	}
	return strings.Join(parts, "; ")
}

func plainDigest(teams string, unseen, asks []Event) string {
	lines := []string{fmt.Sprintf("Catch-up: %s since you last looked.", countOf(len(unseen), "event"))}
	if teams != "" {
		lines = append(lines, "Teams: "+teams+".")
	}
	var conflicts, actions []Event
	for _, ev := range unseen {
		switch {
		case ev.Type == "conflict":
			conflicts = append(conflicts, ev)
		case !notActions[ev.Type]:
			actions = append(actions, ev)
		}
	}
	if len(conflicts) > 0 {
		lines = append(lines, "Conflicts: "+quoted(conflicts)+".")
	}
	if len(actions) > 0 {
		lines = append(lines, "Latest: "+quoted(actions[max(0, len(actions)-digestRecent):])+".")
	}
	if len(asks) > 0 {
		lines = append(lines, "Asked of you, unanswered: "+quoted(asks)+".")
	}
	return strings.Join(lines, "\n")
}

func (inc *Incident) sendDigest(actor string, since int) {
	inc.mu.Lock()
	unseen := inc.unseenBy(actor, since)
	teams := inc.teamsText()
	asks := inc.unansweredAsks(actor, unseen)
	inc.mu.Unlock()

	text := plainDigest(teams, unseen, asks)
	if inc.brain != nil {
		ctx, cancel := context.WithTimeout(context.Background(), digestTimeout)
		written, err := inc.brain.writeDigest(ctx, actor, teams, unseen, asks)
		cancel()
		if err != nil {
			slog.Warn("digest write failed, using the plain one", "actor", actor, "err", err)
		} else if written != "" {
			text = written
		}
	}
	inc.append(Event{
		Actor: captainMorgue,
		Type:  "digest",
		To:    []string{actor},
		Text:  text,
		Why:   fmt.Sprintf("You missed %s since seq %d.", countOf(len(unseen), "event"), since),
	})
}

func (b *brain) writeDigest(ctx context.Context, actor, teams string, unseen, asks []Event) (string, error) {
	prompt := fmt.Sprintf("Catch up %s.\nTeams now: %s\nEvents they missed:\n%s\nAsks to %s still unanswered:\n%s", actor, teams, eventLog(unseen), actor, eventLog(asks))
	out, err := ask[struct {
		Lines []string `json:"lines"`
	}](ctx, b, anthropic.OutputConfigEffortLow,
		"You brief a responder who joined late or was away during a live incident. Write at most 6 short plain-text lines: who is on which team and who manages it, any open conflicts, the last few actions, and anything asked of them that is still unanswered (with the seq so they can reply). Use only facts given; skip a topic with nothing to say.",
		prompt, object(map[string]any{"lines": strList}))
	if err != nil {
		return "", err
	}
	return strings.Join(out.Lines[:min(len(out.Lines), digestLines)], "\n"), nil
}

func countOf(n int, noun string) string {
	if n == 1 {
		return "1 " + noun
	}
	return fmt.Sprintf("%d %ss", n, noun)
}
