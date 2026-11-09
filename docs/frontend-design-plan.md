# CaptainMorgue frontend design plan

Status: draft for discussion, 2026-11-09. Owner: Jubril. Baseline: main at 7ebf17f.

## Confirmed direction

- A full responder workspace: people message and act on incidents from the browser as well as Claude Code.
- Warm ivory workspace with dark ink navigation, inspired by the Captain Morgan bottle references.
- A small local component library, sized for the hackathon deadline.
- One incident for the demo. Wall-screen mode is a presentation of the same incident.
- Every responder may perform every incident action for the demo; backend still records actor and validates current state.
- Emmanuel/team owns action APIs. Our implementation stays frontend.
- User requested local Storybook for reviewing screens and interactions.

These choices expand the wall-screen-only assignment in the build plan. This document proposes the frontend and the service handoffs; it does not change an API contract or claim the missing actions exist.

## References and lessons

The live reference is https://design.costgraph.ai/, retrieved on 2026-11-09 (site reports build 007d574). It emphasizes semantic tokens, reusable patterns, consistent alignment, and side panels inside the page. The supplied local CostGraph checkout is on feat/gpu-launch-blog at 0dd479b2 with unrelated changes; it was read without modification.

Useful local paths under ~/wrk/baselinehq/costgraph-web-v2:

- apps/dashboard/src/styles/palette.css and semantics.css: base colors mapped to roles.
- apps/dashboard/src/styles/typography.css: typography roles.
- apps/design-system/.storybook/preview.css: reference uses actual application styles.
- packages/ui/src/: shared primitives and their variants.
- apps/dashboard/src/components/network/network.tsx: selection in the URL, persistent context, detail panels.
- apps/dashboard/src/lib/queries/network.ts: keep existing data during refresh.

Adopt those principles with one token sheet and one component specimen page. Incident narratives and messages must wrap; CostGraph's single-line rule for compact data should not hide critical instructions. Use native accessible scrolling for this cut. A docked inspector is worthwhile; resizing and a custom scroll library are optional.

## Visual system

Bottle cues: ivory paper, near-black lettering, amber liquid, brass trim, muted red label. Use flat surfaces, fine rules, generous text contrast and restrained accents. No parchment texture or decorative script in operational content. A serif wordmark can be explored after the workspace works; keep the existing sans and mono fonts for the first pass.

| Role | Proposed color | Use |
| --- | --- | --- |
| Canvas | #F6F1E7 | Main workspace |
| Paper | #FFFDF7 | Panels, forms, record |
| Ink | #241D18 | Navigation, primary text |
| Secondary text | #6C6054 | Supporting details |
| Boundary | #DDD2BF | Decorative separation |
| Amber | #A65E20 | Primary action and selected treatment |
| Brass | #A3874B | Small decorative rules and brand detail |
| Red | #A33935 | Destructive action and urgent conflict |
| Green | #397255 | Confirmed recovery |
| Slate blue | #426A80 | Information and evidence |

Calculated solid-color contrast: ink on canvas 14.76:1; secondary text on paper 6.00:1; paper on amber 4.87:1; red/green/blue on paper 6.46/5.56/5.73:1. Brass on paper is 3.37:1, so it is not small body text. These checks do not validate the eventual complete interface. Form boundaries and focus rings need sufficiently strong dedicated tokens.

Map colors to --surface, --surface-raised, --text, --text-secondary, --border, --action, --on-action, --danger, --warning, --success, --info. Give status families foreground/background/border roles. Warning is identified by icon and explicit text as well as color; do not make every amber element look urgent.

Use a 4px spacing scale, 16px panel padding, 6px control corners, 8px panel corners, 40px primary controls, 14-16px operational body text and tabular mono timestamps. Focus must remain visible. Reduced motion removes movement. Brand red is not a permanent navigation accent competing with real danger.

## Screen and navigation model

One persistent shell: dark navigation, ivory content, incident header, selected-detail inspector. Main destinations are Incident, Messages, Crew and Record. Do not add separate dashboards for the same facts. URL query state holds view and the selected event/person/part; links reopen the same context.

| Screen or state | What the person sees | Main interactions |
| --- | --- | --- |
| Entry / join | Active incident, impact, roster identity and team, browser/agent connection status | Join as self; observe without joining; clear pending/error state |
| No incident | Quiet empty state and service connection | Declare incident when supported; no fake active incident |
| Incident | Impact/status header, attention items, ordered activity, open parts and crew summary | Inspect evidence, filter activity, claim a part, open a contextual message |
| Messages | Direct asks, team broadcasts and replies; route and reason | Explicit recipient/scope, send, reply, acknowledge; inspect per-recipient delivery |
| Crew | Teams, manager, responsibility, agent connection and last update | Inspect person/team, see assigned parts, message a person/team |
| Record | Facts, resolution summary, investigation/evidence, improvements, past match | Follow source events, open artifacts, copy record link |
| Wall mode | Large incident/attention/crew/activity presentation | Presentation toggle; no composer; same server facts |

Entry uses a roster-based hackathon session rather than a new account system. A roster picker is not authentication: backend must bind actor and permissions to the session. Browser connection and agent connection are separate facts; opening a tab must not claim that a person's agent is online.

Desktop layout: narrow dark navigation, flexible main workspace, persistent attention/parts area. A selected item opens a docked inspector within the content width. At smaller widths, stack sections and show the inspector as a focused view with Back; do not squeeze three columns. Full mobile polish is secondary to a reliable laptop and projector experience.

## Attention and collaboration rules

1. Needs your action: conflict involving you, direct request, approval awaiting you. Persistent named item with resource, reason, owner and next action.
2. Team needs attention: unowned work, suspect/offline manager, election, unanswered request. Distinct warning treatment and ownership.
3. Context: decisions, investigations, relays, joins and recoveries in the feed.
4. Raw activity: compact, filterable rows; no toast for every command.

Personal attention is filtered by authenticated identity. Global incident attention remains visible to everyone. Do not infer urgency or liveness thresholds in the frontend. Until the server provides a lifecycle, a conflict is 'Flagged', not a fabricated count of unresolved conflicts.

- Reading, acknowledging, taking responsibility and resolving are different actions.
- Current relays only prove routing. Show 'Routed to', not 'Delivered'.
- Draft delivery states map to Queued -> Agent received -> Agent briefed. The draft's 'seen' means injected into agent context, not read by a human.
- Explicit human acknowledgement records person and time. It does not resolve a conflict or prove a command was stopped.
- A 'Hold' decision records an instruction; never imply the system cancelled a running command unless the service actually supports that.
- New events never steal focus or move someone reading history. Offer 'New activity' and preserve the selected item and draft message.
- Service disconnection keeps last known data with a clear stale banner. It does not mark every person offline.
- Reconnect deduplicates event IDs and uses server seq for order. Current SSE replays the entire backlog and has no Last-Event-ID support.
- Pending actions are local control states. Shared ownership, resolutions and close status change only after authoritative service confirmation.
- Failed sends retain text. An ambiguous timeout must not silently resend a mutation; require server idempotency before safe automatic retry.
- Empty, unavailable, loading, stale and failed are different panel states. Missing telemetry is not zero telemetry.

## Action flows and proposed authority

Demo authority is confirmed: every responder may perform every incident action. These flows still require backend support.

| Action | Flow | Authority and concurrent updates |
| --- | --- | --- |
| Join | Choose roster identity/team -> join -> incident briefing | Server binds identity; failure keeps entry visible |
| Message | Pick person/team/automatic routing -> compose -> send -> routed receipt | Every responder may ask or broadcast to all; show routing reason |
| Acknowledge | Explicit acknowledgement from a request/conflict detail | Any addressed person; records receipt only |
| Claim | Take unowned part -> pending -> owner confirmed | Server atomically accepts one owner; loser sees who claimed it |
| Reassign | Pick person and reason -> confirm | Any responder for the demo; preserve audit event |
| Resolve part | Enter how/evidence -> submit -> server checks -> resolved | Any responder for the demo; rejection preserves explanation |
| Conflict decision | Review both actions/evidence -> record decision and reason | Any responder for the demo; lifecycle is a backend contract dependency |
| Close incident | Review open parts/signals -> propose -> confirm | Any responder confirms for the demo; server rechecks current state |

Version/term checks and accepted event IDs should accompany actions so stale managers and simultaneous updates do not silently overwrite newer decisions. Exact endpoint names and request fields need agreement with the backend owner.

## Minimal implementation structure

React + Vite is recommended for preserving local input, selection and pending actions while shared data streams. Keep Go serving static web/ output. This requires an explicit frontend build stage in Docker and a Vite development proxy to Go; coordinate that small shared-file change with Emmanuel.

```text
frontend/
  src/
    app.tsx
    tokens.css
    styles.css
    api.ts
    stream.ts
    incident-store.ts
    normalize.ts
    url-state.ts
    ui/
    incident/
web/                     generated static output served by Go
```

Ten reusable pieces: Button, Field, StatusBadge, PresenceChip, Panel, Tabs, Inspector, InlineState, EventRow and AttentionItem. Message cards, incident header, part rows and record sections compose those pieces. Use a local Storybook with screen stories and one foundations/components story, sharing actual imports and tokens. User explicitly requested this review surface. No monorepo, general graph engine, form framework or component package release.

One transport/normalization boundary adapts actual payloads. Components do not parse SSE or guess backend shapes. The server owns incident metrics, progress, liveness, priorities and action outcomes. The frontend owns selection, filters, drafts, expanded details and reading position.

## Backend handoff and current truth

Implemented: POST /events, POST /broadcast, GET /stream, GET /record/{id}, GET /healthz. Current broadcast routes to other active teams' managers, not arbitrary recipients, and provides no agent delivery. State parts/signals are empty. Conflict is an Event, not the richer example object. Record has facts and events, not yet improvements or past_match. Investigation can be shown from real events and links.

Required for a complete responder workspace:

- Session identity and server permissions; roster/session bootstrap.
- Join/leave and separate browser/agent connection state.
- Messages with explicit recipients/scope, reply_to, routing explanation and delivery updates.
- Explicit human acknowledgement distinct from agent inbox acknowledgement.
- Parts with ownership, claim/reassign/resolve mutations and atomic conflict handling.
- Conflict decision/lifecycle and actor-attributed close, available to every responder for the demo.
- Stable mutation IDs/idempotency and returned event/version identifiers.
- State fields for truthful attention, presence, counts, signals and record sections.

Scope conflict: plan section 5a adds joining/inbox/elections and says owner unassigned/not Emmanuel; Emmanuel's ledger says he plans that work; plan section 7 still cuts elections. Confirm ownership and committed demo features. Do not turn this frontend plan into an unassigned backend commitment.

## Build order and completion checks

1. Agree action authority and backend owner. Freeze the smallest working action contract.
2. Build tokens, shell and specimen states; review the Incident composition in ivory/ink.
3. Connect actual stream, roster, activity, evidence and record. Verify reconnect and preserve focus/drafts.
4. Land session/join, messaging and ownership/resolution actions as service support becomes available. Test with two browsers plus a real agent.
5. Add delivery/presence/election states only when real events exist. Wall mode reuses the incident components.
6. Rehearse the full story and reserve the final block for fixes.

If time is constrained, reduce destinations to Incident (messages/crew in panels) plus Record. Keep real join/message/claim/resolve flows as the collaboration priority. Defer graph interaction, onboarding administration, archive/search, custom animation and full theme switching. If backend support cannot land, explicitly revise the demo scope; a read-only result does not satisfy the confirmed full-workspace request.

Acceptance: simultaneous claim has one winner; message scope and recipient status are truthful; acknowledgement is separate from resolution; a reconnect does not duplicate events or erase a draft; updates preserve focus/scroll; unresolved attention remains discoverable; a stale action fails visibly; missing data does not become invented facts; keyboard navigation and essential contrast work; the final record follows actual incident data.

## Decisions still needed

1. Emmanuel/team owns browser-action APIs; which actions will land before rehearsal?
2. Confirm elections are a committed demo feature or a state we design for but activate later.
3. Review the proposed screens in local Storybook before production integration. Storybook interactions use explicit sample state and make no backend mutations.
