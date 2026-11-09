# CaptainMorgue frontend design plan

Status: draft for discussion, 2026-11-09. Owner: Jubril. Baseline: main at bfcb853, including coordination, replies, receive plugin, live wall screen and E2E checks.

## Confirmed direction

- A full responder workspace centered on agent-driven collaboration. Agents conduct most investigation and conversation; people step in for questions, reply approval, decisions and exceptions. Browser actions supplement Claude Code.
- Warm ivory workspace with dark ink navigation, inspired by the Captain Morgan bottle references.
- A small local component library, sized for the hackathon deadline.
- One incident for the demo. Wall-screen mode is a presentation of the same incident.
- Every responder may perform every incident action for the demo; backend still records actor and validates current state.
- Emmanuel/team owns action APIs. Our implementation stays frontend.
- User requested local Storybook for reviewing screens and interactions.
- Use CostGraph actual layout/component patterns more directly, with CaptainMorgue colors. The initial preview was too independent and too close to human chat.

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

Bottle cues: ivory paper, near-black lettering, amber liquid, brass trim, muted red label. Use flat surfaces, fine rules, generous text contrast and restrained accents. No parchment texture or decorative script in operational content. Use CostGraph typography roles and families (Geist interface, Funnel Display headings, mono evidence), compact app headers and consistent controls. The bottle supplies color and character; it does not call for an editorial or decorative type system.

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

Use CostGraph-derived dimensions: 4px spacing scale, 16px panel padding, compact 36px controls, 12px card corners, a 240px navigation rail and 64px top bar, with 14px interface copy and tabular mono timestamps. Keep major incident context readable on the projector. Focus must remain visible. Reduced motion removes movement. Brand red is not a permanent navigation accent competing with real danger.

## Screen and navigation model

One persistent shell: dark navigation, ivory content, incident header, selected-detail inspector. Main destinations are Incident, agent coordination, Crew and Record. Do not add separate dashboards for the same facts. URL query state holds view and the selected event/person/part; links reopen the same context.

| Screen or state | What the person sees | Main interactions |
| --- | --- | --- |
| Entry / join | Active incident, impact, roster identity and team, browser/agent connection status | Join as self; observe without joining; clear pending/error state |
| No incident | Quiet empty state and service connection | Declare incident when supported; no fake active incident |
| Incident | Impact/status header, attention items, ordered activity, open parts and crew summary | Inspect evidence, filter activity, claim a part, open a contextual message |
| Agent coordination | Agent-owned conversations, requests, research/evidence, proposed replies and escalations | Review/edit/approve a proposed reply, ask through your agent, inspect route and delivery; human input is a focused exception |
| Crew | Human owners paired with their agents, current task, team, manager and connection state | Inspect agent work and assigned parts, route an ask through CaptainMorgue |
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

- Reading, acknowledging, approving a reply, answering, taking responsibility and resolving are different actions.
- Conversation cards show both the acting agent and accountable human. Tool reads and agent progress stay quiet; pending human approval and unanswered requests get priority.
- A proposed answer is editable and requires explicit approval before send in the P0 flow. Returning it to the agent means further research, not a sent reply. These approval transitions are sample-only until a backend contract supports them.
- Routing alone does not prove delivery. Show delivery only when the corresponding service receipt exists.
- Service delivery states sent/delivered/seen map to Sent -> Agent received -> Agent briefed. The draft's 'seen' means injected into agent context, not read by a human.
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
| Message | Pick person/team/all responders -> compose -> send -> routed receipt | Every responder may ask or broadcast to all; show routing reason |
| Acknowledge | Explicit acknowledgement from a request/conflict detail | Any addressed person; records receipt only |
| Claim | Take unowned part -> pending -> owner confirmed | Server atomically accepts one owner; loser sees who claimed it |
| Reassign | Pick person and reason -> confirm | Any responder for the demo; preserve audit event |
| Resolve part | Enter how/evidence -> submit -> server checks -> resolved | Any responder for the demo; rejection preserves explanation |
| Conflict decision | Review both actions/evidence -> record decision and reason | Any responder for the demo; lifecycle is a backend contract dependency |
| Close incident | Review open parts/signals -> propose -> confirm | Any responder confirms for the demo; server rechecks current state |

Accepted event IDs and atomic ownership checks are requested for browser actions. Stale-term rejection is explicitly P1 in the latest team cut, not a promised P0 capability. Exact action endpoints and request fields need agreement with Emmanuel/team.

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

Implemented: POST /events, POST /broadcast, GET /stream, GET /record/{id}, GET /healthz, join/leave/vote, heartbeat, inbox/ack and POST /messages with ask/broadcast/reply. Coordination delivers messages to actor inboxes and publishes per-recipient delivery states. The receive plugin injects asks and replies into Claude Code; people approve replies there. State parts/signals are empty. Conflict is an Event, not the richer example object. Record now includes parts, improvements and past_match; live state also carries past_match. Record generation is asynchronous after close with no readiness field, so one immediate fetch may still show empty sections. Request readiness/version or agree refresh behavior. Investigation can be shown from real events and links.

Required for a complete responder workspace:

- Per-person browser session identity and actor attribution beyond the shared team token; roster/session bootstrap.
- Join/leave now exists; separate browser/agent connection state still needs agreement.
- Explicit messages, numeric reply_to, routing explanation and delivery updates now exist; human approval lifecycle remains a design-to-API handoff.
- Explicit human acknowledgement distinct from agent inbox acknowledgement.
- Parts with ownership, claim/reassign/resolve mutations and atomic conflict handling.
- Conflict decision/lifecycle and actor-attributed close, available to every responder for the demo.
- Stable mutation IDs/idempotency and returned event/version identifiers.
- State fields for truthful attention, presence, counts, signals and record sections.

The P0 coordination, receive plugin and live wall screen have landed and the wall-screen handoff to Jubril is recorded. Elections are P0. Older unassigned section 5a and elections-cut text are superseded. Our separate frontend/ preview leaves the working web/index.html available during design review.

The new contract commits join/leave, heartbeat, inbox/ack, explicit messages and elections. It adds people[actor] = {status, team, last_seen}, teams[].term and deliveries[seq][actor] = sent|delivered|seen. Normalize legacy string people values and these objects at integration. These endpoints are implemented on baseline bfcb853, with the receive plugin and live-wall consumer merged. Shared bearer access does not by itself prove per-person browser identity, and actor-level presence does not distinguish browser from agent.

Human-loop asks must show awaiting answer, answered, automated status response and escalation separately from delivery. An automated status response does not answer the human request. Dispatch says no reply in 60 seconds; the P0 table says not acknowledged in 60 seconds. Implementation now accepts kind reply with numeric reply_to and emits a reply event, although the P0 table still omits reply. Derive answered from that linked reply event, not from seen; approval state is not a service field. Current expireAsks skips recipients marked seen: a briefed but unanswered ask does not time out. The first linked reply also removes the whole ask from pending, even for multiple recipients. Emmanuel/team should reconcile these behaviors with the human-loop spec. Preview escalation demonstrates an unbriefed timeout; it must not promise a backend timeout after briefing. Model-picked recipients are P1; the P0 composer uses explicit person/team/root targets.

## Build order and completion checks

1. Freeze the smallest working action contract with Emmanuel/team; authority and ownership are already confirmed.
2. Build tokens, shell and specimen states; review the Incident composition in ivory/ink.
3. Connect actual stream, roster, activity, evidence and record. Verify reconnect and preserve focus/drafts.
4. Land session/join, messaging and ownership/resolution actions as service support becomes available. Test with two browsers plus a real agent.
5. Add delivery/presence/election states only when real events exist. Wall mode reuses the incident components.
6. Rehearse the full story and reserve the final block for fixes.

If time is constrained, reduce destinations to Incident (messages/crew in panels) plus Record. Keep real join/message/claim/resolve flows as the collaboration priority. Defer graph interaction, onboarding administration, archive/search, custom animation and full theme switching. If backend support cannot land, explicitly revise the demo scope; a read-only result does not satisfy the confirmed full-workspace request.

Acceptance: simultaneous claim has one winner; message scope and recipient status are truthful; acknowledgement is separate from resolution; a reconnect does not duplicate events or erase a draft; updates preserve focus/scroll; unresolved attention remains discoverable; a stale action fails visibly; missing data does not become invented facts; keyboard navigation and essential contrast work; the final record follows actual incident data.

## Decisions still needed

1. Emmanuel/team owns browser-action APIs; which actions will land before rehearsal?
2. Reconcile unanswered versus unacknowledged timeout and reply/answered schema with Emmanuel/team; elections are committed P0.
3. Review the CostGraph-aligned, agent-first screens in local Storybook before production integration. Storybook interactions use explicit sample state and make no backend mutations.
