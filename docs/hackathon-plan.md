# Hackathon build plan

Four hours, three people, demo at 5:30. This is the cut of [prd.md](prd.md) and [architecture.md](architecture.md) that we build today. Agree section 1 in the first 10 minutes, then work in parallel.

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

## 3. Person 1: the service

Go, one binary, serves the API and `web/index.html`.

| By | Done when |
|---|---|
| 1:00 | `/events`, `/broadcast`, `/stream`, `/record` work in memory; roster loaded; `curl` an event and see it on `/stream`. Image builds from a `Dockerfile`. |
| 1:15 | Image tag handed to person 3 (public GHCR). |
| 2:00 | Events stored in Elasticsearch (`cm-events`, `text` copied to a `semantic_text` field), one past record seeded in `cm-records`. If Elastic Cloud is not ready by 1:30, stay in memory. |
| 2:45 | Relay picks recipients with Claude (`anthropic-sdk-go`) from the roster, owned services and recent events, and writes `why`. Conflict rule: two different actors, same `resource`, within 2 minutes, one of them a write, emits a `conflict` event. Record writer builds `/record` from the events with Claude, plus the Elasticsearch match. |

Libraries: stdlib `net/http` for the server and SSE, `gopkg.in/yaml.v3`, `github.com/elastic/go-elasticsearch/v9`, `github.com/anthropics/anthropic-sdk-go`.

Config: `PORT`, `ROSTER`, `ELASTIC_URL`, `ELASTIC_API_KEY`, `ANTHROPIC_API_KEY`. Credentials go into a Kubernetes Secret created by hand, never into git (the cluster repo is public).

## 4. Person 2: agent and wall screen

| By | Done when |
|---|---|
| 1:00 | Plugin hooks send events to `$CM_URL/events`. `/broadcast` command posts to `/broadcast`. Tested against person 1's laptop. `scripts/replay.sh` replays the demo events. |
| 2:00 | `web/index.html` is `docs/demo.html` with the built-in `EVENTS` replaced by `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render the tree, parts, relay, conflict, investigation and signals. Playback controls removed. |
| 2:45 | Record tab reads `/record/INC-1`. The "happened before" card shows `past_match`. |

Plugin layout:

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

## 5. Person 3: cluster, Radar and the story

| By | Done when |
|---|---|
| 0:15 | `## Before` in `STORY.md` with Radar Checks for `team-captainmorgue`, plus a screenshot. Everyone signed in to Radar Cloud. |
| 1:00 | Conference app (check-in and payments, one small service is fine) with a CloudNativePG Postgres, shipped through Argo CD and visible in Radar. Prometheus scrape annotations on it. |
| 1:30 | CaptainMorgue service deployed from person 1's image, with its Secret, reachable at `https://captainmorgue.cnh.radarhq.io`. Gitar installed on the app repo. |
| 2:45 | A real release of the app shipped as a canary through Radar. Whatever it shows (a real problem or an all-clear), run a Radar AI investigation and post its summary to `/events` as `type: investigation`. Post Prometheus readings as `signal` events. |
| 4:00 | `## The story` in `STORY.md` from the `demo-story` skill: timeline, investigation, Checks before and after. Screenshots taken. |

Budget: 2 CPU and 4 GiB of requests for everything in the cluster. Keep the service and app at 100m / 128Mi requests.

## 6. Checkpoints

- **1:00** Person 2's hooks land in person 1's service. The app is live on the cluster.
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
