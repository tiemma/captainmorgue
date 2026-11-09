package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const (
	model         = "claude-opus-5-5"
	modelTimeout  = 5 * time.Second
	recordTimeout = 2 * time.Minute
	relayContext  = 30
)

type brain struct {
	client anthropic.Client
}

func newBrain() *brain {
	key := os.Getenv("ANTHROPIC_API_KEY")
	if key == "" {
		return nil
	}
	return &brain{client: anthropic.NewClient(option.WithAPIKey(key), option.WithMaxRetries(0))}
}

func ask[T any](ctx context.Context, b *brain, effort anthropic.OutputConfigEffort, system, prompt string, schema map[string]any) (T, error) {
	var out T
	resp, err := b.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 16000,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
		OutputConfig: anthropic.OutputConfigParam{
			Effort: effort,
			Format: anthropic.JSONOutputFormatParam{Schema: schema},
		},
	})
	if err != nil {
		return out, err
	}
	if resp.StopReason != anthropic.StopReasonEndTurn {
		return out, fmt.Errorf("model stopped with %s", resp.StopReason)
	}
	for _, block := range resp.Content {
		if text, ok := block.AsAny().(anthropic.TextBlock); ok {
			return out, json.Unmarshal([]byte(text.Text), &out)
		}
	}
	return out, errors.New("model returned no text")
}

func object(props map[string]any) map[string]any {
	required := make([]string, 0, len(props))
	for k := range props {
		required = append(required, k)
	}
	return map[string]any{"type": "object", "properties": props, "required": required, "additionalProperties": false}
}

var (
	str     = map[string]any{"type": "string"}
	strList = map[string]any{"type": "array", "items": str}
)

func eventLog(events []Event) string {
	var b strings.Builder
	for _, ev := range events {
		fmt.Fprintf(&b, "%d %s %s/%s [%s]", ev.Seq, ev.TS.Format(time.TimeOnly), ev.Team, ev.Actor, ev.Type)
		if ev.Resource != nil {
			fmt.Fprintf(&b, " on %s", resourceLabel(ev.Resource))
		}
		fmt.Fprintf(&b, ": %s\n", ev.Text)
	}
	return b.String()
}

func rosterText(r Roster) string {
	var b strings.Builder
	for _, t := range r.Teams {
		fmt.Fprintf(&b, "- %s (%s): manager %s, members %s, owns %s\n", t.Name, t.ID, t.Manager, strings.Join(t.Members, ", "), strings.Join(t.Owns, ", "))
	}
	return b.String()
}

type recipients struct {
	To  []string `json:"to"`
	Why string   `json:"why"`
}

func (b *brain) pickRecipients(ctx context.Context, roster Roster, from, text string, recent []Event) (recipients, error) {
	prompt := fmt.Sprintf("Roster:\n%s\nRecent incident events:\n%s\nBroadcast from %s: %q\n\nWho should receive this broadcast?", rosterText(roster), eventLog(recent), from, text)
	return ask[recipients](ctx, b, anthropic.OutputConfigEffortLow,
		"You route messages during a live incident at a conference. Pick the fewest people on the roster who can answer or act on the broadcast: owners of the services it mentions and people already working on the related resources. Never include the sender. Use roster logins exactly. Explain the pick in one sentence in why.",
		prompt, object(map[string]any{"to": strList, "why": str}))
}

type conflictVerdict struct {
	Conflict bool   `json:"conflict"`
	Why      string `json:"why"`
}

func (b *brain) judgeConflict(ctx context.Context, prev, ev Event) (conflictVerdict, error) {
	prompt := fmt.Sprintf("Earlier:\n%s\nNow:\n%s\nDo these two actions conflict?", eventLog([]Event{prev}), eventLog([]Event{ev}))
	return ask[conflictVerdict](ctx, b, anthropic.OutputConfigEffortLow,
		"Two people acted on the same Kubernetes resource within two minutes during an incident. Decide whether the second action undoes, races with, or contradicts the first. Reads and actions that agree are not conflicts. Explain in one sentence in why.",
		prompt, object(map[string]any{"conflict": map[string]any{"type": "boolean"}, "why": str}))
}

type writtenRecord struct {
	Summary      string        `json:"summary"`
	FixedBy      string        `json:"fixed_by"`
	Parts        []RecordPart  `json:"parts"`
	Improvements []Improvement `json:"improvements"`
}

func (b *brain) writeRecord(ctx context.Context, title string, roster Roster, events []Event) (writtenRecord, error) {
	prompt := fmt.Sprintf("Incident: %s\nRoster:\n%s\nEvents:\n%s", title, rosterText(roster), eventLog(events))
	return ask[writtenRecord](ctx, b, anthropic.OutputConfigEffortMedium,
		"Write the record of a resolved incident from its events. summary: two or three sentences on what broke, why, and who fixed it. fixed_by: who fixed it, as Name (Team). parts: each distinct problem as a short name and how it was resolved. improvements: concrete follow-ups, each with the roster login that should own it and a link from the events when one fits, else an empty string. Use only facts from the events.",
		prompt, object(map[string]any{
			"summary":  str,
			"fixed_by": str,
			"parts":    map[string]any{"type": "array", "items": object(map[string]any{"name": str, "how": str})},
			"improvements": map[string]any{"type": "array", "items": object(map[string]any{
				"text": str, "owner": str, "link": str,
			})},
		}))
}
