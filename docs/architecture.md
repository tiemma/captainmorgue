# CaptainMorgue architecture

Status: hackathon design | Companion to [prd.md](prd.md) | Diagram: [captainmorgue-map.html](captainmorgue-map.html)

The PRD says what CaptainMorgue does. This doc says how it is built and how the work splits across the team. Anything still unsettled is in section 12.

## 1. Components

| Component | Built with | Runs where | Job |
|---|---|---|---|
| `captainmorgue` service | Go | Demo cluster | Root of the team tree. A2A server for every agent, event handling and routing, the record, recall, elections, conflict checks, connections to outside services, the live stream for the web app. |
| `cm` binary and Claude Code plugin | Go binary, plugin manifest | Each responder's laptop | The person's agent. Plugin hooks send every prompt, command and tool call to `cm`, which scrubs secrets and forwards events to CaptainMorgue. `cm` also runs a local MCP server so Claude Code can broadcast, mention, report status and join incidents. |
| Web app | React + Vite | Browser on the big screen | Live team tree, event log, timeline, relay feed, workstreams and the record, fed by server-sent events. Design system in `design/`. |
| Elasticsearch | Elastic Cloud | Hosted | Store of record for events, incidents and records, with embeddings for recall. |
| Dash0 | SaaS | Hosted | Alerts that open incidents, telemetry through its MCP server, deep questions handed to Agent0. |
| Radar | In-cluster install | Demo cluster | Topology, Kubernetes events and team labels through its MCP server. |
| Gitar | GitHub app | Demo app repository | Reviews fix and improvement pull requests and confirms CI is green. |
| Chaos Mesh | Kubernetes operator | Demo cluster | Injects the demo faults from declarative experiments. |

Libraries, chosen up front so nobody re-litigates them:

| Need | Package | Why |
|---|---|---|
| A2A | `github.com/a2aproject/a2a-go` | Official Go SDK, v2.8.0, released 2026-11-06. |
| Elasticsearch | `github.com/elastic/go-elasticsearch/v9` (typed API, bulk indexer) | Official client, v9.5.2. |
| MCP client and server | `github.com/modelcontextprotocol/go-sdk` | Official Go SDK. Used for Dash0 and Radar from the service, and for the `cm` local server. |
| Model calls | `github.com/anthropics/anthropic-sdk-go` | Conflict judgement, routing reasons, record writing. |
| Secret scrubbing | gitleaks rules (`github.com/zricethezav/gitleaks/v8` detect package) | Maintained rule set for tokens, keys and connection strings. The same rules run on the laptop and in the service. |
| Fault injection | Chaos Mesh experiments | Solved problem; declarative, repeatable, and resets cleanly between demo runs. |
| Embeddings | Elasticsearch `semantic_text` | Elasticsearch embeds on write through its own inference endpoint, so there is no embedding code. |

## 2. Team tree

- Teams nest. A team holds people and sub-teams, and has exactly one manager.
- The first person to join or be assigned to a team becomes its manager. The incident manager is the manager at the top and has no special powers.
- A team of one is folded into the team above.
- CaptainMorgue sits above every top-level team.
- A team is addressed by its path from the root, such as `checkout/edge`. The path is the routing key and the prefix every event in that subtree carries.

## 3. The agent on the laptop

- The Claude Code plugin registers hooks for `UserPromptSubmit`, `PreToolUse` and `PostToolUse`. Each hook pipes its payload to `cm hook`, which turns it into an event.
- `cm` scrubs secrets with the gitleaks rules before anything leaves the laptop.
- `cm` holds one A2A connection to CaptainMorgue, authenticated as the person, and publishes the person's agent card: name, team path, role, what the agent can do.
- `cm mcp` is a local MCP server that Claude Code loads through the plugin. Its tools are `join`, `broadcast`, `mention`, `status`, `declare` and `ask_record`. Claude uses these the way it uses any tool, so a person can type "tell payments the pool is saturated" and the agent sends the broadcast.
- Incoming dispatches and relayed messages arrive over A2A. `cm` shows them in Claude Code as a notification on the next turn.

## 4. Messaging

- Every interaction between agents goes through CaptainMorgue. Agents never call each other directly.
- Every dispatch is an A2A task. Task states (submitted, working, input required, completed, failed) are the status that flows up the tree and shows in the web app.
- A broadcast goes to CaptainMorgue, which picks the recipients and stores the reason with the relay. Recipient picking combines the ownership sources (section 7), agent cards, and recall over who answered similar messages before (section 6).
- An @mention names its recipient, and still passes through CaptainMorgue so it lands in the record.

## 5. Events and the record

Everything in an incident is an event. One schema covers all of them.

| Field | Type | Notes |
|---|---|---|
| `incident_id` | keyword | |
| `team_path` | keyword | Subtree the event belongs to, such as `checkout/edge`. |
| `seq` | long | Sequence number within `team_path`, assigned by that subtree's manager. Replay order is `(team_path, seq)`, merged by `ts`. |
| `ts` | date | When it happened on the person's laptop. |
| `actor` | keyword | The person, `captainmorgue`, or an integration such as `dash0`. |
| `type` | keyword | `action`, `decision`, `message`, `dispatch`, `status`, `evidence`, `conflict`, `election`, `resolution`, `close`. |
| `resource` | object | Kubernetes kind, namespace and name when the event touches one. Used by the conflict rule. |
| `text` | text plus `semantic_text` copy | What happened, in words. Embedded on write for recall. |
| `artifacts` | nested | Links and excerpts: Dash0 views, Radar views, log lines, pull requests. |
| `signal` | object | Alert signal value before and after, for progress scoring. |

Indices:

- `cm-events`: every event, appended by CaptainMorgue with the bulk indexer.
- `cm-incidents`: one document per incident: state, team tree, managers, parts and their status. Updated in place.
- `cm-records`: one document per closed incident: summary (`semantic_text`), how each part was resolved, improvements, links back to events.

Ordering: each manager's agent assigns `seq` for its subtree and gossips the subtree log upward. CaptainMorgue writes what arrives and fills gaps when late events land, so the web app shows events in order even when laptops are briefly offline.

When an incident closes, CaptainMorgue retrieves the incident's events, asks the model to write the record from them, and stores it in `cm-records` with a link from every line to the event it came from.

## 6. Recall with embeddings

Each `text` and record summary is a `semantic_text` field, so Elasticsearch embeds it on write. Queries use a hybrid retriever: keyword match and semantic match fused with reciprocal rank fusion, in one request.

What recall powers:

- **This has happened before.** On open, and again when new evidence arrives, CaptainMorgue searches `cm-records` with the alert and the first events. A close match shows in the web app with who fixed it and how.
- **Who to pull in.** People who resolved similar parts before rank higher when CaptainMorgue picks who to page and who to relay to.
- **Routing broadcasts.** A broadcast is matched against past messages and their answers to find who answered similar questions.
- **Conflict context.** When the model judges a possible conflict, it gets the earlier decisions that are semantically closest to the new action, not just the latest ones.
- **Ask the incident.** `ask_record` in Claude Code and a search box in the web app answer questions like "what did we try on the database" from the incident's own events.
- **Writing the record.** The record writer retrieves the events most relevant to each part instead of reading the whole log.

For the demo, `cm-records` is seeded with one earlier record of a similar cascading failure.

## 7. Ownership and pulling people in

CaptainMorgue combines four sources to decide who owns an affected service:

1. Team labels on Kubernetes workloads, read through Radar.
2. The Dash0 service catalog.
3. CODEOWNERS in the application repository.
4. Who resolved similar parts in past records, from recall.

It sends a join prompt to the owners' agents with the team already set. Later, PagerDuty supplies who is on call for each team.

## 8. Conflicts and progress

- **Rule.** Two events from different people touching the same `resource` within a short window, where at least one is a write, are a candidate conflict.
- **Model.** Every new action is also checked by the model against the closest earlier decisions (section 6). The model confirms or dismisses each rule candidate and explains the conflict in one sentence. A confirmed conflict is relayed to both people and their managers.
- **Progress.** A step counts as progress when the alerting signal in Dash0 moves back toward normal after it. CaptainMorgue reads the signal through Dash0's MCP server before and after each action and stores both values on the event. The web app renders the stored values; it does no math.

## 9. Manager election

- When a manager's agent stops responding, the team elects a new one, Raft-style.
- The voters are the team's members plus CaptainMorgue. A two-person team with one person gone still has a majority, two of three.
- The new manager takes over the subtree log from CaptainMorgue's copy and continues `seq` from the last stored value.

## 10. Reading outside systems

- CaptainMorgue holds the MCP connections to Dash0 and Radar. People use them through their own agent, and every read lands in the record.
- MCP first. When MCP cannot answer, for example a bulk export or a join across sources, the model writes code against the service's API. The code runs in a sandbox, and the code itself goes into the record.
- Deep telemetry questions go to Dash0 Agent0 through `runTask`.
- Everyone in the incident can see everything CaptainMorgue reads. Per-person limits come later.

## 11. The demo

Setup: a small microservice app on the demo cluster (frontend, checkout, payments, a database), instrumented to Dash0, Radar installed, team labels on every workload, the app repository with Gitar installed, and one seeded past record.

1. A Chaos Mesh experiment crashes the checkout service. The restarts and retries take down the database, and payments fails next.
2. Dash0 alerts. CaptainMorgue opens the incident, finds the owners and pulls in three teams. The seeded past incident shows as a match.
3. Responders work it from Claude Code on their own laptops. The web app streams every event, the tree fills in, and relays show why each person was told.
4. Two people act on the database at once. CaptainMorgue flags the conflict with the model's explanation.
5. A manager drops off and the team elects a new one.
6. The fix ships as a pull request that Gitar reviews and confirms green. Signals recover and progress fills in.
7. The incident closes and the record appears, with improvements opened as pull requests.

Fallback: a recorded run of a full rehearsal.

## 12. Work split

| Stream | Scope | Done when |
|---|---|---|
| Service core | A2A server, event handling, `cm-events` and `cm-incidents`, SSE stream, team tree, elections | Two laptops join, events stream in order to a test page. |
| Agent | `cm` binary, plugin hooks, scrubbing, local MCP tools | A Claude Code session produces events and can broadcast. |
| Web app | Tree, event log, timeline, relay feed, workstreams, record, from the design system | Renders a live incident from SSE. |
| Intelligence | Recall, ownership, routing reasons, conflict model, progress scoring, record writer | The demo's match, routing, conflict and record all appear. |
| Demo world | App, cluster, Dash0 and Radar, Chaos Mesh experiments, Gitar, seeded record, recorded fallback | The fault reproduces on demand and resets cleanly. |

Suggested order: service core and agent first, since everything depends on events flowing; then the web app and demo world in parallel; intelligence last, layered on real events.

## 13. Open

- What happens to a running incident if the CaptainMorgue service is down? A reasonable hackathon answer: agents buffer events locally and replay them with their `seq` when it returns.
- Must a person picked as manager by a vote accept?
- What happens to a one-person team directly under CaptainMorgue?
- The conflict rule's window length.
- Whether Agent0's findings are copied into the record or linked, and who watches its credits.
