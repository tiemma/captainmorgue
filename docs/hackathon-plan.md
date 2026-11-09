# Hackathon build plan

Four hours, three people, demo at 5:30.

| Who | Owns | Branch to start from |
|---|---|---|
| Emmanuel (tiemma) | The CaptainMorgue service and the Claude Code plugin: coordination, ordering, relay, conflicts, the record | `feat/service`, `feat/plugin`, `feat/service-intel` |
| Jubril | The wall screen: `web/index.html` on the live stream, the record tab, the team view | `feat/service` (`web/index.html` is `docs/demo.html` today) |
| Sammy | The cluster: conference app, Elasticsearch, Dash0, deploying CaptainMorgue, Gitar, the canary release, the Radar AI investigation, and the 5:30 story | `feat/infra` in `tiemma/captainmorgue-cluster` |

The public URL `https://captainmorgue.cnh.radarhq.io` is the CaptainMorgue service: it serves the wall screen and the API. The conference app is internal and is watched through Radar. This is the cut of [prd.md](prd.md) and [architecture.md](architecture.md) that we build today. Agree section 1 in the first 10 minutes, then work in parallel.

## 0. What the judges score

1. The project runs on Kubernetes with Radar connected.
2. Radar's UI and MCP are used throughout building and operating it.
3. A Radar AI investigation of a real issue, and what we did with it.
4. It makes conferences easier.

Everything below serves one of those. They also ask teams not to break things on purpose for the demo, so the incident is a real release, not an injected fault.

## 1. The contract

Base URL: `$CM_URL` (local: `http://localhost:8080`, deployed: `https://captainmorgue.cnh.radarhq.io`). One incident at a time for the demo; `incident_id` is `INC-1` unless set.

### `POST /events` -> `202`

```json
{
  "incident_id": "INC-1",
  "ts": "2026-11-09T16:41:02Z",
  "actor": "dana",
  "team": "registration",
  "type": "action",
  "text": "Aborted the checkin canary, back to v1.7",
  "resource": { "kind": "Rollout", "namespace": "team-captainmorgue", "name": "checkin" },
  "artifacts": [{ "label": "Radar: rollout checkin", "url": "https://app.radarhq.io/..." }]
}
```

- `type`: `alert`, `action`, `decision`, `relay`, `conflict`, `investigation`, `signal`, `ship`, `join`, `close`. Same kinds `docs/demo.html` renders.
- `resource` and `artifacts` are optional.
- The service adds `id` and `seq` (increasing per incident) and stamps `ts` if it is missing.

### `POST /broadcast` -> `202`

```json
{ "incident_id": "INC-1", "from": "gus", "text": "Is the database failing over? Payments are timing out." }
```

The service picks the recipients from the roster and recent events, and emits a `relay` event with `to` and `why`.

### `GET /stream` (server-sent events)

Two event names:

- `event: event`, `data:` one stored event, as above plus `id`, `seq`, and for relays `to: []` and `why`.
- `event: state`, `data:` the derived view, sent after every change:

```json
{
  "incident": { "id": "INC-1", "title": "Check-in kiosks failing at Hall B", "status": "open", "opened": "...", "closed": null },
  "teams": [{ "id": "registration", "name": "Registration", "manager": "dana", "members": ["ana", "cal"], "pulled_in": true }],
  "people": { "dana": "working", "ana": "in_incident", "ben": "offline" },
  "parts": [{ "id": "checkin", "name": "Check-in slow", "owner": "registration", "progress": 60, "status": "open", "resolved_at": null, "note": "v1.7 serving" }],
  "relay": { "from": "gus", "to": ["dev", "dana"], "text": "...", "why": "..." },
  "conflict": { "a": { "actor": "dana", "action": "..." }, "b": { "actor": "dev", "action": "..." }, "resource": "...", "why": "...", "held": false },
  "signals": { "checkin_p95": { "value": "1.1 s", "status": "bad" } }
}
```

The service computes every number in `state`. The web app renders it and does no math.

### `GET /record/INC-1`

```json
{
  "id": "INC-1", "title": "...", "opened": "...", "resolved": "...", "duration": "10 min",
  "people": 7, "teams": 3, "conflicts": 1,
  "parts": [{ "name": "...", "how": "..." }],
  "improvements": [{ "text": "...", "owner": "cal", "link": "..." }],
  "past_match": { "id": "INC-1877", "summary": "...", "fixed_by": "..." }
}
```

### `roster.yaml`

```yaml
teams:
  - id: registration
    name: Registration
    manager: dana
    members: [ana, cal]
    owns: [checkin, schedule]
  - id: ticketing
    name: Ticketing and Payments
    manager: eli
    members: [gus, fay]
    owns: [tickets, payments]
  - id: platform
    name: Platform
    manager: ben
    members: [dev]
    owns: [confdb]
```

Replace the example names with our three GitHub logins before the demo.

## 2. Repository layout

```
roster.yaml
service/          Go service (person 1)
web/index.html    wall screen, from docs/demo.html (person 2)
plugin/           Claude Code plugin (person 2)
scripts/replay.sh posts the demo.html events to /events for testing (person 2)
```

The app and its deploy manifests live in `tiemma/captainmorgue-cluster` (person 3).

## 3. Emmanuel: the service and the plugin

Go, one binary, serves the API and `web/index.html`.

| By | Done when |
|---|---|
| 1:00 | `/events`, `/broadcast`, `/stream`, `/record` work in memory; roster loaded; `curl` an event and see it on `/stream`. Image builds from a `Dockerfile`. |
| 1:15 | Image tag handed to person 3 (public GHCR). |
| 2:00 | Events stored in Elasticsearch (`cm-events`, `text` copied to a `semantic_text` field), one past record seeded in `cm-records`. If Elastic Cloud is not ready by 1:30, stay in memory. |
| 2:45 | Relay picks recipients with Claude (`anthropic-sdk-go`) from the roster, owned services and recent events, and writes `why`. Conflict rule: two different actors, same `resource`, within 2 minutes, one of them a write, emits a `conflict` event. Record writer builds `/record` from the events with Claude, plus the Elasticsearch match. |

Libraries: stdlib `net/http` for the server and SSE, `gopkg.in/yaml.v3`, `github.com/elastic/go-elasticsearch/v9`, `github.com/anthropics/anthropic-sdk-go`.

Config: `PORT`, `ROSTER`, `ELASTIC_URL`, `ELASTIC_API_KEY`, `ANTHROPIC_API_KEY`. Credentials go into a Kubernetes Secret created by hand, never into git (the cluster repo is public).

## 4. Jubril: the wall screen

| By | Done when |
|---|---|
| 1:00 | `scripts/replay.sh` (on `feat/plugin`) replays the demo events into a local service, and the page is wired to it. |
| 2:00 | `web/index.html` is `docs/demo.html` with the built-in `EVENTS` replaced by `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render the tree, parts, relay, conflict, investigation and signals. Playback controls removed. |
| 2:45 | Record tab reads `/record/INC-1`. The "happened before" card shows `past_match`. |

Plugin layout (Emmanuel, on `feat/plugin`):

```
plugin/.claude-plugin/plugin.json
plugin/hooks/hooks.json      UserPromptSubmit and PostToolUse -> hooks/send.sh
plugin/hooks/send.sh         reads the hook JSON on stdin, posts an event with curl and jq
plugin/commands/broadcast.md /broadcast <text>
```

- Each person sets `CM_URL`, `CM_ACTOR` (GitHub login) and `CM_TEAM` in their shell.
- `send.sh` sends the prompt text for `UserPromptSubmit`, and for `PostToolUse` the tool name, the command or file path, and success or failure. It never sends tool output, which keeps secrets out without a scrubber today.
- `resource` is filled when the command names a Kubernetes object (`kubectl ... deploy/checkin`) or a Radar MCP call carries `kind` and `name`.
- `send.sh` must never block or fail the Claude Code turn: short timeout, errors ignored after logging to a file.

## 5. Sammy: the cluster, Radar and the story

| By | Done when |
|---|---|
| 0:15 | Done: `## Before` is in `STORY.md`. Everyone signed in to Radar Cloud. |
| 1:00 | Review and merge `feat/infra`: the conference app (check-in and payments on a CloudNativePG Postgres, with team labels, Prometheus scraping and a rehearsal-only slow switch), CaptainMorgue as Service `app`, and the Dash0 and Elasticsearch resources. Create the hand-made Secrets (`captainmorgue`, Dash0 token) through Radar `apply_resource`. Sync through Radar and confirm every workload is healthy. |
| 1:30 | Make the GHCR package `ghcr.io/tiemma/captainmorgue` public, deploy it, and open `https://captainmorgue.cnh.radarhq.io`. Install Gitar on `tiemma/captainmorgue-cluster`. Check Dash0 receives the app's telemetry and Elasticsearch is green. |
| 2:15 | Write the real release: a small change to check-in (a new attendee lookup) shipped as an Argo Rollouts canary through Radar. |
| 2:45 | Whatever the canary shows (a real problem or an all-clear), run a Radar AI investigation on it, promote or abort, and post the summary to `/events` as `type: investigation`. Post the Prometheus or Dash0 readings as `signal` events. |
| 3:00 | Lead the rehearsal and screen-record it. |
| 4:00 | `## The story` in `STORY.md` from the `demo-story` skill: timeline, investigation, Checks before and after. Screenshots taken. |

Budget: 2 CPU and 4 GiB of requests for everything in the cluster. Keep the service and app at 100m / 128Mi requests.

## P0: what the 5:30 demo needs (everything else is cut)

Built in parallel on three branches against the contract below. Cut to P1: auto mode and channels, Claude-picked recipients, CaptainMorgue's own Dash0/Radar connections, digests, folding teams into parents, stale-term handling, offline spooling.

### P0 contract (additions to section 1)

All calls send `Authorization: Bearer $CM_TOKEN`; the service checks it when its own `CM_TOKEN` is set (unset = local dev, no auth). Incident is `INC-1`.

| Call | Body | Returns |
|---|---|---|
| `POST /incidents/INC-1/join` | `{actor, team}` | `{incident, team, manager, term, members: [{actor, status}], cursor}`; emits `join`; first online member of a team with no online manager becomes manager |
| `POST /incidents/INC-1/leave` | `{actor}` | `204`; emits `leave`; manager leaving starts an election now |
| `POST /heartbeat` | `{actor}` | `204`; every 5 s from the poller |
| `GET /inbox/{actor}?after=<seq>&wait=25` | | `{messages: [envelope], cursor}`; long-poll, returns early on a new message |
| `POST /inbox/{actor}/ack` | `{seq}` | `204`; marks every message up to `seq` seen |
| `POST /messages` | `{from, to: ["dana" or "registration" or "root"], kind: "ask" or "broadcast", text, reply_to?}` | `{seq, to: [actors], why}`; a team id expands to its joined members, `root` to everyone joined |
| `POST /incidents/INC-1/vote` | `{actor, term, candidate, granted}` | `204`; sent automatically by the poller |

Envelope: `{id, seq, ts, from, to, kind, text, why, term, priority, reply_to}`; `kind` is one of `ask`, `broadcast`, `relay`, `conflict`, `election`, `vote_request`, `escalation`, `autoreply`; `priority` is `interrupt` (conflict, ask, vote_request, escalation) or `inject`.

Rules: heartbeat 5 s, `suspect` after 15 s, `offline` after 30 s. Manager offline 30 s -> term + 1, candidate = online member with the highest acked cursor, `vote_request` to the team's online members, CaptainMorgue votes for the candidate, majority of (members + CaptainMorgue) wins, `election` event. An `ask` not acked in 60 s -> `autoreply` to the sender with the recipient's latest event, and `escalation` to the recipient's manager. Conflicts go to both parties as `interrupt`.

`/stream` `state` adds: `people: {actor: {status, team, last_seen}}`, `teams[].term`, and `deliveries: {seq: {actor: "sent" or "delivered" or "seen"}}` for asks, broadcasts, relays and conflicts.

### P0 branches

| Branch | Builds | Owner |
|---|---|---|
| `feat/coord` | Service: join, leave, heartbeat, liveness, inbox, ack, messages, token, elections, escalation, auto-reply, state additions | crew agent, reviewed by Emmanuel |
| `feat/plugin-receive` | Plugin: `join`, `leave`, `status`, `inbox`, `broadcast`, `ask` commands; poller (`plugin/bin/cm-poll`: heartbeat, long-poll, local inbox cache, desktop notification, auto-vote); hooks inject unread messages on SessionStart, UserPromptSubmit and PostToolUse and ack them; Stop blocks while an interrupt is unread | crew agent, reviewed by Emmanuel |
| `feat/web-live` | Wall screen on `/stream`: live log, tree with online / suspect / offline and manager + term, ask and broadcast cards with sent / delivered / seen, conflicts, elections, record tab | crew agent starts it, **Jubril takes it over** |

## 5a. Joining, receiving and the plugin commands (owner: to assign)

Design in [dispatch.md](dispatch.md) sections 3d-1 (joining), 5 (getting messages into a session) and 7a (failure modes). Not owned by Emmanuel; pick it up by adding it to your ledger.

| Piece | Done when |
|---|---|
| Service: `POST /incidents/{id}/join`, `/leave`, `POST /heartbeat`, `GET /inbox/{actor}?after=`, `POST /inbox/{actor}/ack` | Join returns team, manager, term, cursor; inbox long-polls; broadcast to a team delivers to every connected member of that subtree |
| Plugin commands: `join`, `leave`, `status`, `inbox`, `broadcast [team]`, `ask @who`, `take`, `resolve`, `open`, `close` | Each command posts to the service and prints what happened |
| Plugin receive path: `SessionStart` briefing, unread messages injected on `UserPromptSubmit` and `PostToolUse`, `Stop` blocks while a conflict is unread | Verified in a real session with two laptops |
| Auto mode: `/captainmorgue:auto on` registers the plugin's MCP server as a channel and pushes inbox messages into the session; auto-reply with current status for asks unseen after 60 s; team token header on every call | In auto mode, Dev's agent reacts to a conflict with no one typing |
| Poller (plugin monitor, fallback `cm poll &`): heartbeat every 5 s, held `/inbox`, desktop notification, local inbox cache the hooks read | Closing a laptop shows amber at 15 s, election at 30 s |

## 6. Checkpoints

- **1:00** The plugin's events land in the service, the wall screen draws them, and `feat/infra` is merged.
- **2:00** The service runs in the cluster. Two laptops stream into the wall screen.
- **2:45** One full run: release, broadcasts, a conflict, the investigation, the record.
- **3:00** Rehearsal with all three laptops, screen-recorded as the fallback.
- **3:30** Fixes only. No new features.

## 7. Cut today

Said in the pitch as next steps, already designed in the architecture doc:

- A2A between agents: plain HTTP to the service today.
- Manager elections and per-team ordered logs: one team tree from `roster.yaml`, the service orders events.
- Dash0 and Agent0: signals come from the cluster's Prometheus through Radar. Add Dash0 only if OpenTelemetry export works within 30 minutes.
- The team relationship view: the static one in `docs/demo.html`.
- Secret scrubbing: replaced by never sending tool output.
- Onboarding: `roster.yaml` instead.
