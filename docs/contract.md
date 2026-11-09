# CaptainMorgue API contract

Status: matches `service/*.go` on `main` | Live: https://captainmorgue.cnh.radarhq.io | Older design: [hackathon-plan.md](hackathon-plan.md) section 1

This is what the service actually serves today. The wall screen (`web/index.html`) and the plugin (`plugin/bin/cm`) are both clients of it.

## The rule: the frontend renders, it never computes

Every number, label, list and status on the wall comes from the service already worked out. The frontend formats (local time, display names, colours) and lays out. It does not count, sum, diff times, derive a status, or work out who holds what. If the wall needs a value the service does not send, add it to `State` in `service/state.go` and render it; do not compute it in the browser.

## Auth

When the service runs with `CM_TOKEN` set, every request except plain `GET`s needs `Authorization: Bearer <token>`. `GET /inbox/{actor}` also needs it. A missing or wrong token is `401`. Production runs without a token, so the wall (`GET /`, `GET /stream`, `GET /record/{id}`) never needs one.

Any request body that is not valid JSON gets `400`.

## Routes

The incident id is `INC-1` unless the service sets `INCIDENT_ID`. Routes with `{id}` answer `404 no such incident` for any other id.

| Method and path | Request body | Success | Errors | Emits |
|---|---|---|---|---|
| `GET /` | | `200` static files from `WEB_DIR` | | |
| `GET /healthz` | | `200`, empty | | |
| `GET /stream` | | `200` `text/event-stream`, see [Stream](#stream) | `500` if streaming is unsupported | |
| `GET /record/{id}` | | `200` [Record](#record) | `404` | |
| `GET /record/{id}.md` | | `200` `text/markdown`, the RFO | `404` | |
| `GET /records` | | `200` array of `{"id", "title", "severity", "opened", "resolved", "duration", "summary", "fixed_by"}`, newest first | | |
| `POST /events` | an [Event](#event); needs `actor` and a `type` from: `alert action decision relay conflict investigation signal ship join close note action_item pr` | `202`, empty | `400`; `403` a `close` from anyone but the commander (or a team manager when there is no commander); `409` a `close` when already closed | that event; `close` also resolves the incident and writes the record |
| `POST /broadcast` | `{"from": "login", "text": "..."}` | `202`, empty (the relay is appended a moment later) | `400` if `from` or `text` is empty | `relay` |
| `POST /incidents/{id}/join` | `{"actor", "team"?, "role"?, "task"?, "repo"?, "tools"?: []}` | `200` [join response](#join-response) | `400` bad role, missing actor, team not in `roster.yaml`; `404` | `join`, then a `digest` for the joiner when they missed events |
| `POST /incidents/{id}/leave` | `{"actor"}` | `204` | `404` not joined or wrong incident | `leave`, then `vote_request` when the leaver managed the team |
| `POST /incidents/{id}/task` | `{"actor", "task"}` | `204` | `404` not joined or wrong incident | `action` with text `Working on: <task>` |
| `POST /incidents/{id}/status` | `{"actor", "status"?, "severity"?, "why"?, "part"?}`; `status` one of `investigating mitigated resolved closed`, `severity` one of `sev1 sev2 sev3`; with `part`, `status` must be `mitigated` or `resolved` and applies to that part only | `200` `{"status", "severity"}` (the incident's) | `400` bad value or neither given, or a part status other than `mitigated`/`resolved`; `403` resolved or closed by anyone but the commander (or a team manager when there is no commander); `409` not forward, or already closed; `404` | `status`, or `close` for `closed` (text is `why`, the summary) |
| `POST /incidents/{id}/vote` | `{"actor", "term", "candidate"?, "granted": bool}` | `204` | `409` no election open for that term and candidate; `404` | `election` once a majority grants |
| `POST /heartbeat` | `{"actor"}` | `204` | `404` not joined | no event; a `state` when the actor's status flips back to online, and a `digest` when they come back after missing enough |
| `GET /inbox/{actor}?after=<seq>&wait=<seconds>` | | `200` `{"messages": [Envelope], "cursor": <seq>, "unread": <n>}` | `400` when `after` or `wait` is not a number | marks `sent` deliveries `delivered`, then a `state` |
| `POST /inbox/{actor}/ack` | `{"seq"}` | `204` | | marks every delivery up to `seq` `seen`, then a `state` |
| `POST /messages` | `{"from", "to": [], "kind": "ask"\|"broadcast"\|"reply", "text", "reply_to"?}` | `200` `{"seq", "to": [], "why"}` | `400` missing fields, unknown recipient, no recipient, `reply_to` not an ask | `ask`, `broadcast` or `reply` |
| `POST /claims` | `{"actor", "text", "resource": {"kind", "namespace"?, "name"}}` | `200` `{"granted": true, "key", "holder"}` or `{"granted": false, "key", "holder", "reason"}` | `400` missing actor, kind or name | `claim` on a new grant (not a renewal); `conflict` to the holder when refused |
| `GET /approvals` | | `200` array of [Approval](#approvals), oldest first | | |
| `POST /approvals` | `{"incident_id"?, "actor", "action", "resource"?: Resource, "why"}` | `200` the new [Approval](#approvals) | `400` missing actor, action or why; `404` wrong `incident_id`; `409` nobody can approve (no other manager or commander) | `approval_request` to the approver |
| `POST /approvals/{id}` | `{"actor", "decision": "approve"\|"deny", "why"?}` | `200` the decided [Approval](#approvals) | `400` bad id or decision; `403` actor is neither the approver nor the commander; `404` no such approval; `409` not pending (decided or expired) | `approval` to the requester |

Notes:

- `join`: `role` is `commander`, `responder` (default) or `scribe`. Team managers are elected, never chosen. Only one commander: a second `commander` join comes back with `role: "responder"`. `team` defaults to the actor's team in `roster.yaml`. The first online joiner of a team with no online manager becomes its manager and the term goes up by one.
- `inbox`: without `after`, the actor's acked cursor is used. `wait` long-polls, capped at 25 s; it returns as soon as a message lands. An empty poll returns `{"messages": [], "cursor": <after>, "unread": <n>}`. `unread` is how many inbox messages are after the actor's acked cursor, whatever `after` was; the web nav badge shows it.
- `messages` `to` entries are a login, a team id (everyone joined in that team), or `root` (everyone joined). The sender is never in `to`. A `reply` goes to the asker of `reply_to` and ignores `to`.
- `status`: the incident only moves forward through `open investigating mitigated resolved closed` and may skip steps. Anyone may move it to `investigating` or `mitigated` and set severity. Only the commander, or any team manager when nobody is commander, may move it to `resolved` or `closed`. `POST /events` with `type: close` goes through the same check (`403`). Only one `close` is ever appended per open incident: a second, even concurrent, gets `409`, so the RFO is written once. A status with `part` never moves the incident.
- `approvals`: the approver is the actor's team manager, or the commander when the actor manages the team (or has no manager). The commander may decide any approval. A pending approval expires 5 minutes after the request. The plugin's PreToolUse hook (`plugin/hooks/approve.sh`) denies destructive cluster writes unless `GET /approvals` has one for the same actor and exact action string with `usable: true`; `CM_APPROVALS=off` turns the hook off.
- `claims`: the key is `namespace/kind/name`, kind lowercased. A grant holds for 5 minutes; the same actor claiming again renews it. A claim stops counting once it expires or its holder goes offline.

### Join response

```json
{"incident": "INC-1", "team": "platform", "manager": "tiemma", "term": 1, "role": "commander",
 "commander": "tiemma", "members": [{"actor": "tiemma", "status": "online"}], "cursor": 0}
```

## Stream

`GET /stream` is server-sent events with two event names.

| Name | Data | When |
|---|---|---|
| `event` | one [Event](#event) | On connect, every event so far in `seq` order (the backlog). After that, every new event as it is appended. |
| `state` | the whole [State](#state) | Once on connect, right after the backlog. After every `event`. On its own whenever something changes without an event: a person goes suspect or offline (checked every second), a heartbeat brings someone back online, a delivery moves to `delivered` or `seen`, a past match arrives. |

A `: keepalive` comment comes every 15 s. Each `state` replaces the previous one whole; never merge. On reconnect the backlog replays from `seq 1`, so the client clears its log when the connection opens (the wall does this in `reset()`).

Every `event` is followed by a `state`, so the wall can redraw panels from `state` alone and use `event` only to add a log row.

## State

| Field | Type | Meaning |
|---|---|---|
| `incident.id` | string | Incident id, `INC-1`. |
| `incident.title` | string | Incident title (`INCIDENT_TITLE`). |
| `incident.status` | `"open"` \| `"investigating"` \| `"mitigated"` \| `"resolved"` \| `"closed"` | The latest `status` event, `closed` once a `close` event exists. An `open` event (a new alert after close) starts over at `open` with no severity. |
| `incident.severity` | `""` \| `"sev1"` \| `"sev2"` \| `"sev3"` | The latest severity set. |
| `incident.opened` | RFC 3339 time or null | Timestamp of the first event. |
| `incident.closed` | RFC 3339 time or null | Timestamp of the `close` event. |
| `counts` | object | Ready-to-show totals for the KPI row: `parts` (`parts[]`), `claims` (active `claims[]`), `crew_online` (`people` online), `crew_total` (`people`), `events` (all events), `open_asks` (`ask` events with no `reply`), `open_prs` (`prs[]`), `action_items` (`action_item` events with an owner). |
| `teams[]` | array, roster order | One entry per team in `roster.yaml`, live. |
| `teams[].id`, `.name` | string | From the roster. |
| `teams[].manager` | string | Current manager's login, `""` when nobody manages. |
| `teams[].members` | string[] or null | Everyone on the team (roster plus joined) except the manager. `null` when the team has nobody besides the manager. |
| `teams[].owns` | string[] | Services the team owns, from the roster. |
| `teams[].term` | int | Manager term. Goes up on every new manager or election. `0` before anyone managed. |
| `teams[].pulled_in` | bool | True once any event in the incident is tagged with this team. |
| `people` | object, login to Person | Everyone on a roster team plus everyone who has ever joined. |
| `people[x].status` | `"online"` \| `"suspect"` \| `"offline"` | Liveness from heartbeats: suspect after 15 s silent, offline after 30 s (`CM_SUSPECT_AFTER`, `CM_OFFLINE_AFTER`). Never joined, or left, is `offline`. |
| `people[x].team` | string | Team id. |
| `people[x].last_seen` | RFC 3339 time or null | Last join or heartbeat. Absent (null) for roster people who never joined. |
| `people[x].role` | string, omitted when unset | `commander`, `responder` or `scribe`, as given at join. |
| `people[x].task` | string, omitted when unset | What they are working on (join or `/task`). |
| `people[x].repo` | string, omitted when unset | Repository they work in. |
| `people[x].tools` | string[], omitted when unset | Tools they have. |
| `commander` | string | Login of the incident commander, `""` when none. |
| `relay` | object or null | The latest `relay` or `broadcast` event: `{"from", "to": [], "text", "why"}`. |
| `conflict` | [Event](#event) or null | The latest `conflict` event, whole. |
| `claims[]` | array, oldest first | Active claims only: `{"key": "ns/kind/name", "actor", "text", "since", "expires"}`, times RFC 3339. |
| `approvals[]` | array of [Approval](#approvals), oldest first | Every approval this incident, including decided and expired ones. |
| `deliveries` | object, seq (as a string key) to object of login to status | Per recipient delivery of every `ask`, `broadcast`, `relay`, `conflict` and `approval_request`: `sent` (queued), `delivered` (their poller fetched it), `seen` (they acked it, or replied to the ask). |
| `parts[]` | array, first named first | One per distinct problem named with `part` on a `note` (`/captainmorgue:note --part <name> <text>`) or on a part status (`/captainmorgue:status-set mitigated --part <name> [why]`). `{"id", "name"}` are the name, `owner` who first named it, `note` the latest note text on it, `status` `investigating` until a part status sets `mitigated` or `resolved`, `progress` 0, 50 or 100 to match, `resolved_at` the first part status time. An `open` event starts the list over. |
| `signals` | object, key to Signal | Two sources, one shape, see [Signals](#signals): `<service>` from the latest `alert`/`recovered` event carrying a `signal`, and `<service>_<metric>` from live Dash0 queries. `{}` when neither has happened. |
| `prs[]` | array, oldest first | Pull requests opened for affected services: `{"service", "url", "author", "ts"}`, one per `pr` event. |
| `repos` | object or null | From `roster.yaml` `services`: service name to `{"repo", "paths": []}`. `/captainmorgue:fix` reads it. |
| `past_match` | object or null | Closest past incident from Elasticsearch: `{"id", "summary", "fixed_by"}`. Null when Elasticsearch is not configured or nothing matches. |

Live `state` from production, 2026-11-09 (before `commander` shipped):

```json
{"incident":{"id":"INC-1","title":"Conference operations","status":"open","opened":"2026-11-09T22:04:13.736103895Z","closed":null},
 "teams":[{"id":"registration","name":"Registration","manager":"","members":null,"owns":["checkin","kiosk"],"term":0,"pulled_in":false},
          {"id":"platform","name":"Platform","manager":"tiemma","members":[],"owns":["confdb","otel-collector","captainmorgue"],"term":1,"pulled_in":true}],
 "people":{"tiemma":{"status":"online","team":"platform","last_seen":"2026-11-09T22:07:52.732523467Z","role":"commander","task":"running the incident desk","repo":"tiemma/captainmorgue"}},
 "parts":[],"relay":null,"conflict":null,"signals":{},"past_match":null,"claims":[],"deliveries":{}}
```

Busier fields from a local run:

```json
{"commander":"tiemma",
 "claims":[{"key":"registration/deployment/kiosk","actor":"kemi","text":"rollout restart","since":"2026-11-09T22:08:57.646465Z","expires":"2026-11-09T22:13:57.646465Z"}],
 "deliveries":{"13":{"jubril":"delivered","kemi":"delivered","sammy":"delivered"},"14":{"sammy":"seen"}}}
```

## Approvals

| Field | Type | Meaning |
|---|---|---|
| `id` | int | Approval id, from 1. `cm approve <id>`, `cm deny <id> [why]`. |
| `actor` | string | Who asked to run the action. |
| `approver` | string | Who must decide: the actor's team manager, or the commander. |
| `action` | string | The exact action string the hook derived, `kubectl delete pod confdb-0 -n team-captainmorgue`. |
| `resource` | Resource, omitted when unset | Optional target. |
| `why` | string | Why the actor needs it. |
| `status` | `"pending"` \| `"approved"` \| `"denied"` \| `"expired"` | `expired` once `expires` passes while pending. |
| `requested`, `expires` | RFC 3339 time | Request time and request time plus 5 minutes. |
| `decided_by`, `note` | string, omitted when unset | Who decided and their why. |
| `decided` | RFC 3339 time or null | When it was decided. |
| `usable` | bool | True while approved and within 10 minutes of the decision; the hook lets the action through only then. |

Events: `approval_request` (actor is the requester, `to` the approver, delivered as an `interrupt`) and `approval` (actor is the decider, `to` the requester, `inject`). Both are in the record timeline; the RFO counts requests under what went well and lists denials under errors.

## Signals

When the service runs with `DASH0_AUTH_TOKEN` set (and `DASH0_API_URL`, default `https://api.us-west-2.aws.dash0.com`), it runs three PromQL range queries against Dash0 every 30 s (`CM_SIGNAL_EVERY`) while the incident is open (an `open` event after the last `close`), over every service a roster team `owns`. `DASH0_DATASET` picks the dataset; unset uses the organization default. Unset or failing, `signals` stays as it was and the failure is logged once.

| Metric key | Query (per `service_name`, server spans, 2 m rate) | `warn` at | `critical` at |
|---|---|---|---|
| `requests` | `dash0.spans` rate, requests per second | never | never |
| `errors` | `dash0.spans` with `otel_span_status_code="ERROR"` over all, in percent | 1 % | 5 % |
| `p95` | `histogram_quantile(0.95, dash0.spans.duration)`, in ms | 500 ms | 1000 ms |

A service with no spans in Dash0 gets no entry. Each Signal (alert-derived ones carry only `value` and `status`, `critical` on alert and `ok` with value `recovered`):

| Field | Type | Meaning |
|---|---|---|
| `label` | string | Ready to show, `checkin p95 latency`. |
| `service` | string | The owned service. |
| `value` | string | Latest point, formatted: `4.5/s`, `0.4%`, `640 ms`. |
| `status` | `"ok"` \| `"warn"` \| `"critical"` | Latest point against the thresholds above. |
| `series` | number[] | Up to the last 15 points, 30 s apart, oldest first, in the metric's unit. |
| `spark` | number[] | `series` scaled to 0..1 (min to max; flat series is all 0.5), ready to draw. |

When a signal's `status` changes (a new signal counts as changing from `ok`), the service appends a `signal` event: `actor: dash0`, `team` the owning team, text `checkin p95 latency is critical at 1400 ms (was warn)`.

```json
"signals":{"checkin_p95":{"label":"checkin p95 latency","service":"checkin","value":"150 ms","status":"ok",
  "series":[10,20,30,40,50,60,70,80,90,100,110,120,130,140,150],"spark":[0,0.071,0.143,0.214,0.286,0.357,0.429,0.5,0.571,0.643,0.714,0.786,0.857,0.929,1]}}
```

## Event

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `<incident>-<seq>`. |
| `seq` | int | 1-based position in the incident. Also the event count. |
| `incident_id` | string | `INC-1`. |
| `ts` | RFC 3339 time | When it happened (UTC). |
| `actor` | string | Who did it: a login, `captainmorgue` for the service, or a tool (`dash0`, `radar`, `gitar`, `argo`). |
| `team` | string, omitted when empty | Team the event belongs to; filled from the roster or the join when the poster leaves it out. |
| `type` | string | See the table below. |
| `text` | string | What happened, ready to show. May contain newlines (`digest`). |
| `resource` | `{"kind", "namespace"?, "name"}`, omitted | The cluster object it touches. |
| `artifacts` | `[{"label", "url"?}]`, omitted | Links (traces, pull requests, runs). |
| `to` | string[], omitted | Logins it was routed to. |
| `why` | string, omitted | Why those recipients, or why the service did it. |
| `term` | int, omitted when 0 | Sender's team term. |
| `reply_to` | int, omitted when 0 | The `seq` this answers or follows up. |
| `exit_code`, `duration_ms` | int, omitted | On `action` events from the shell hook. Shown in the RFO steps. |
| `status` | string, omitted | On `status` events, the state it moved to. |
| `severity` | string, omitted | On `status` events, the severity it set. |
| `part` | string, omitted | On `note` and `status` events, the incident part it is about. See `state.parts`. |

### Event types

| Type | Posted by | Fields it sets | Means |
|---|---|---|---|
| `alert` | `POST /events` (Dash0) | `resource`, `artifacts` | An alert opened or fired. |
| `investigation` | `POST /events` (Radar) | `artifacts` | An investigation finding. The wall shows the latest in its Investigation panel. |
| `action` | `POST /events`, or `POST /incidents/{id}/task` | `resource` | Someone did something. From `/task` the text is `Working on: <task>`. Two writes on one resource within 2 minutes raise a `conflict`. |
| `decision` | `POST /events` | `resource` | A decision; counts as a write for conflict checks. |
| `signal` | `POST /events`, or the service when a Dash0 signal changes status | `team` | A telemetry signal. |
| `ship` | `POST /events` (Gitar, Argo) | `artifacts` | A fix shipped. |
| `status` | `POST /incidents/{id}/status` | `status`, `severity`, `why`, `part`? | The incident moved state or changed severity; text is `moved INC-1 to <status>, set severity <sev>: <why>`. With `part`, only that part moved; text is `marked <part> <status>: <why>`. |
| `close` | `POST /incidents/{id}/status` with `closed`, or `POST /events` | | Incident closed; text is the closing summary. The RFO is written right after, then each action item owner gets an `action`. |
| `note` | `POST /events` (`/captainmorgue:note`) | `part`? | A finding, decision or piece of evidence (a Radar investigation, a Dash0 query). The latest is the fallback root cause. |
| `action_item` | `POST /events` (`/captainmorgue:action`) | `to` (the owner) | A follow-up for the RFO. A URL in the text becomes its `link`. |
| `pr` | `POST /events` (`cm pr`) | `resource` `{"kind": "Service", "name": <service>}`, `artifacts` `[{"label": "pull request", "url"}]` | A pull request opened for an affected service. Becomes `state.prs` and the RFO's remediation. |
| `action` from `captainmorgue` | service, after the RFO is written | `to` (one owner), `why` | That owner's action items, one per line. |
| `join` | `POST /incidents/{id}/join` (or `/events`) | `team`, `term`, `to` (everyone already joined), `why` | Someone joined, with role; text adds `and manages <team>, term N` when they became manager. |
| `leave` | `POST /incidents/{id}/leave` | `team` | Someone left. |
| `ask` | `POST /messages` | `to`, `why`, `term` | A question to people or a team. Any recipient who has not seen it after 60 s (`CM_ASK_TIMEOUT`) triggers an `autoreply` to the asker and an `escalation` to that recipient's manager. A reply stops the clock. |
| `reply` | `POST /messages` | `to` (the asker), `why`, `term`, `reply_to` (the ask) | An answer to an ask. |
| `broadcast` | `POST /messages` | `to`, `why`, `term` | A message to a team or `root`. Becomes `state.relay`. |
| `relay` | `POST /broadcast` | `to`, `why` | A broadcast whose recipients CaptainMorgue picked (Claude, or managers of the other pulled-in teams). Becomes `state.relay`. |
| `autoreply` | service, ask timeout | `actor: captainmorgue`, `to` (the asker), `reply_to`, `why` | The recipient has not seen the ask; quotes their latest event. |
| `escalation` | service, ask timeout | `actor: captainmorgue`, `to` (recipient's manager), `reply_to`, `why` | Tells the manager their teammate has not answered. |
| `conflict` | service | `actor: captainmorgue`, `resource`, `to`, `why`, `term` when from a claim | Either a claim was refused (`to` is the holder) or two people acted on one resource within 2 minutes (`to` is both). Becomes `state.conflict`. |
| `claim` | `POST /claims` | `resource` | Someone took the claim on `ns/kind/name` before writing to it. Renewals emit nothing. |
| `vote_request` | service, manager offline or left | `actor` (the candidate), `team`, `to` (online team members), `term`, `why` | An election started; the candidate is the online member who has seen the most. |
| `election` | `POST /incidents/{id}/vote` majority | `actor: captainmorgue`, `team`, `to`, `term`, `why` | A new manager won. The wall shows it in the election banner. |
| `digest` | service, on join or return | `actor: captainmorgue`, `to` (one person), `why` | A catch-up for someone who missed events: teams, conflicts, latest actions, unanswered asks. Multi-line. |

Live events from production:

```json
{"id":"INC-1-1","seq":1,"incident_id":"INC-1","ts":"2026-11-09T22:04:13.736103895Z","actor":"tiemma","team":"platform","type":"join","text":"joined INC-1 as commander and manages Platform, term 1","why":"everyone already in INC-1","term":1}
{"id":"INC-1-2","seq":2,"incident_id":"INC-1","ts":"2026-11-09T22:07:15.950146753Z","actor":"tiemma","team":"platform","type":"join","text":"joined INC-1 as commander","why":"everyone already in INC-1","term":1}
```

From a local run:

```json
{"id":"INC-1-3","seq":3,"incident_id":"INC-1","ts":"2026-11-09T22:08:57.312185Z","actor":"captainmorgue","type":"digest","text":"Catch-up: 1 events since you last looked.\nTeams: Platform managed by tiemma (sammy, tiemma).","to":["sammy"],"why":"You missed 1 events since seq 0."}
{"id":"INC-1-10","seq":10,"incident_id":"INC-1","ts":"2026-11-09T22:08:57.660899Z","actor":"captainmorgue","type":"conflict","text":"sammy tried to scale to 3 registration/deployment/kiosk and was blocked because you hold it (rollout restart).","resource":{"kind":"Deployment","namespace":"registration","name":"kiosk"},"to":["kemi"],"why":"kemi holds the claim on registration/deployment/kiosk until 22:13:57.","term":1}
{"id":"INC-1-16","seq":16,"incident_id":"INC-1","ts":"2026-11-09T22:09:14.609791Z","actor":"sammy","type":"reply","text":"yes, 40s behind; failing over now","to":["jubril"],"why":"sammy answered jubril's ask.","term":1,"reply_to":14}
{"id":"INC-1-18","seq":18,"incident_id":"INC-1","ts":"2026-11-09T22:09:23.406855Z","actor":"captainmorgue","type":"autoreply","text":"kemi has not seen your ask yet. Latest from kemi at 22:09:12: Working on: restarting kiosk pods","to":["tiemma"],"why":"No ack from kemi within 8s.","reply_to":17}
```

Times inside service-written `text` and `why` (autoreply, conflict) are UTC `HH:MM:SS`.

## Inbox envelope

What `GET /inbox/{actor}` returns per message. Only these kinds reach an inbox; everything else is stream-only.

| Field | Type | Meaning |
|---|---|---|
| `id`, `seq`, `ts` | | Same as the event. |
| `from` | string | The event's `actor`. |
| `to` | string[] | All recipients. |
| `kind` | string | The event `type`. |
| `text`, `why`, `term` | | Same as the event. |
| `priority` | `"interrupt"` \| `"inject"` | `interrupt`: show now, even mid-task. `inject`: add to the agent's context at the next turn. |
| `reply_to` | int, omitted when 0 | Same as the event. |

| Priority | Kinds |
|---|---|
| `interrupt` | `ask`, `conflict`, `vote_request`, `escalation`, `approval_request` |
| `inject` | `broadcast`, `relay`, `election`, `autoreply`, `reply`, `join`, `digest`, `approval`, `action` (only `action` events that carry `to`) |

Delivery of `ask`, `broadcast`, `relay`, `conflict` and `approval_request` is tracked in `state.deliveries`.

```json
{"id":"INC-1-7","seq":7,"ts":"2026-11-09T22:08:57.449134Z","from":"captainmorgue","to":["kemi"],"kind":"digest","text":"Catch-up: 3 events since you last looked.\nTeams: Registration managed by jubril (jubril, kemi); Platform managed by tiemma (sammy, tiemma).","why":"You missed 3 events since seq 0.","term":0,"priority":"inject"}
```

## Record

`GET /record/{id}` is the Reason For Outage (RFO) as JSON for the current incident, or for a past one stored in Elasticsearch (`404` when neither has it; `502` when Elasticsearch fails); `GET /records` lists closed incidents from Elasticsearch plus the current one once closed. `improvements` and `fixed_by` stay for older clients: `improvements` is the same list as `action_items`. `GET /record/{id}.md` is the same as Markdown. Before close it is a live draft built from the events so far. At close Claude writes the narrative fields when `ANTHROPIC_API_KEY` is set; otherwise, or if Claude fails, the service builds them from the events. The window, timeline, errors, remediation and explicit action items always come from the events. The wall loads it on `close` and on each `action` from CaptainMorgue, and shows it in the Record tab.

| Field | Type | Meaning |
|---|---|---|
| `id`, `title` | string | Incident. |
| `status`, `severity` | string | As in State. |
| `written_by` | `"captainmorgue"` \| `"claude"` | Who wrote the narrative fields. |
| `opened`, `resolved` | RFC 3339 time or null | First event; first time the incident reached `resolved` (or `closed`). |
| `duration` | string | `"<N> min"` from opened to resolved, else `""`. |
| `window` | object | `opened`, `detected` (first `alert`, `page` or `signal`, else opened), `mitigated`, `resolved`, `closed` (times or null), and `to_mitigate`, `to_resolve` (from detected) and `duration` (from opened), each `"<N> min"` or `""`. |
| `people` | int | People listed in `roster.yaml` who posted an event. |
| `teams` | int | Teams pulled in. |
| `conflicts` | int | `conflict` events. |
| `summary` | string | Two or three sentences. Fallback: the closing summary. |
| `root_cause` | string | Fallback: the latest `investigation` or `note`. |
| `contributing_factors[]` | string | Fallback: alerts, and two people acting on one resource. |
| `timeline[]` | `{"ts", "actor", "type", "text"}` | Key events: alerts, signals, status changes, close, conflicts, escalations, elections, investigations, decisions, notes, ships, pull requests, action items. |
| `went_well[]`, `went_badly[]` | string | Fallback: time to mitigate, conflicts caught, claims that blocked a write, auto-replies, elections, asks answered, pull requests; escalations, silent managers, failed actions, alerts. |
| `errors[]` | as `timeline` | Alerts, signals, failed or interrupted actions, conflicts, escalations, denied approvals. |
| `fixed_by` | string | Who fixed it. Fallback: author of the latest `ship` or `pr`. |
| `steps[]` | `{"actor", "steps": [Step]}` | Appendix: every `action` event, grouped into runs of consecutive steps by one person. Step: `{"ts", "actor", "text", "status" ("ok", "failed", "interrupted" or ""), "resource"?, "exit_code"?, "duration_ms"?, "failed", "change"}`. |
| `changes[]` | [Step] | Steps that wrote to a cluster resource (a non-read action with a `resource`). |
| `improvements[]` | as `action_items` | Same list, kept for older clients. |
| `remediation[]` | as `state.prs` | Pull requests opened during the incident. |
| `action_items[]` | `{"text", "owner", "link", "due"}` | Every `action_item` event, then Claude's extra ones. `due` is a hint from severity (sev1 within 2 days, sev2 within 1 week, otherwise within 2 weeks) unless Claude gives one. |
| `parts[]` | `{"name", "how"}` | How each part was resolved; written by Claude at close, `[]` otherwise. |
| `past_match` | object or null | As in State. |
| `events[]` | [Event] | Every event. |
