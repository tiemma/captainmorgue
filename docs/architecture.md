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
| Radar | Radar Cloud (`radar-cloud` MCP) over the team's vcluster | Hosted | Topology, Kubernetes events, team labels, Prometheus queries, GitOps through Argo CD, and hosted AI investigations. Every call passes the `captainmorgue` cluster id. |
| Gitar | GitHub app | Demo app repository | Reviews fix and improvement pull requests and confirms CI is green. |
| Fault switches | Built into the demo app | Demo cluster | Bounded faults turned on and off from CaptainMorgue: crash the checkout service, exhaust the database connection pool, slow payments. |

Libraries, chosen up front so nobody re-litigates them:

| Need | Package | Why |
|---|---|---|
| A2A | `github.com/a2aproject/a2a-go` | Official Go SDK, v2.8.0, released 2026-11-06. |
| Elasticsearch | `github.com/elastic/go-elasticsearch/v9` (typed API, bulk indexer) | Official client, v9.5.2. |
| MCP client and server | `github.com/modelcontextprotocol/go-sdk` | Official Go SDK. Used for Dash0 and Radar from the service, and for the `cm` local server. |
| Model calls | `github.com/anthropics/anthropic-sdk-go` | Conflict judgement, routing reasons, record writing. |
| Secret scrubbing | gitleaks rules (`github.com/zricethezav/gitleaks/v8` detect package) | Maintained rule set for tokens, keys and connection strings. The same rules run on the laptop and in the service. |
| Fault injection | Switches in the demo app, not a chaos tool | The hackathon cluster refuses privileged and host-access pods, which chaos tools such as Chaos Mesh need, and its rules forbid unbounded breakage. App-level switches stay inside our namespace and budget and reset instantly. |
| Embeddings | Elasticsearch `semantic_text` | Elasticsearch embeds on write through its own inference endpoint, so there is no embedding code. |

## 2. Hackathon cluster

The cluster comes from the Cloud Native Hackathon starter (repo `tiemma/captainmorgue-cluster`, from `skyhook-io/cnh-starter`). What it gives and what it limits:

- A vcluster named `captainmorgue`, namespace `team-captainmorgue`, where the team is cluster-admin. Public URL `https://captainmorgue.cnh.radarhq.io`, routed to Service `app` on port 80.
- Deploys are GitOps: push to `main` of the cluster repo and Argo CD syncs. Images come from public GHCR.
- Pre-installed: Argo CD, Argo Rollouts, Prometheus, the CloudNativePG operator and Radar. The demo database is a CloudNativePG cluster from the starter's example.
- Budget across the whole cluster: 2 CPU and 4 GiB of requests, 4 CPU and 8 GiB of limits, 4 PVCs, 20 GiB of storage. Elasticsearch does not fit, so it runs on Elastic Cloud.
- No privileged, hostPath, hostNetwork or hostPID pods, and no LoadBalancer or NodePort services.
- The rules say not to break things on purpose or generate unbounded load. Our faults are bounded, live inside our namespace, and switch off instantly. Confirm with the organisers at the Radar table that this counts as allowed before the demo.

## 2a. Team tree

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

## 9a. Onboarding and the team graph

### Onboarding

- A person signs in (`cm login` or the web app) and picks the team they belong to.
- They join a manager in one of two ways: as a member of that manager's team, or as the manager of a new sub-team under it. A manager names the parent team their team belongs to.
- The result is the standing org tree. Incidents start from it: the onboarded managers lead their teams, first-to-join applies only when a team's manager is not in the incident, and elections cover drop-offs.

### The graph model

Same shape as the CostGraph context graph: entities, aliases and typed edges, with derived values computed at read time, never stored twice.

- `cm-entities`: one document per thing. Kinds: `person`, `team`, `service`, `datastore`, `incident`. `parent_id` nests teams in teams and people in teams, so the tree comes from the entities themselves. `valid_from` and `valid_to`; nothing is deleted.
- `cm-aliases`: the other names an entity is known by, so one service seen as a Kubernetes workload, a Dash0 service and a CODEOWNERS path is one entity. Namespaces: `k8s_workload`, `dash0_service`, `codeowners_path`, `github_login`, `email`.
- `cm-edges`: `a_id`, `b_id`, `means`, `source`, `valid_from`, `valid_to`, `evidence[]`.

| `means` | Between | `source` | Comes from |
|---|---|---|---|
| `member_of` | person to team | configured | Onboarding |
| `manages` | person to team | configured | Onboarding, elections |
| `part_of` | team to team | configured | Onboarding (also `parent_id`) |
| `owns` | team to service or datastore | configured, observed | Kubernetes team labels, Dash0 catalog, CODEOWNERS |
| `calls` | service to service | observed | Dash0 traces, Radar topology |
| `uses` | service to datastore | observed | Radar topology, Dash0 database spans |
| `depends_on` | team to team | inferred | A team's services call or use another team's services. Derived at read time from `owns` plus `calls` and `uses`. |
| `messaged` | team to team | observed | Relays, @mentions and dispatches across teams in `cm-events`. Counted at read time. |
| `shared_incident` | team to team | observed | Both teams pulled into the same incident. Counted at read time. |

`messaged` and `shared_incident` are aggregations over `cm-events` for the requested window, so they never drift from the events. `depends_on` is resolved in the Go service from `owns` and `calls`/`uses`; Elasticsearch does not join.

### API

- `GET /api/graph?start=&end=&focus=&open=` returns `{window, nodes[], links[]}`. Each node: id, kind, name, parent_id, child_count, manager, status. Each link: a, b, means, source, count over the window, evidence (sample calls, message ids, incident ids).
- Closed groups are collapsed in the service: a closed team's links are re-pointed to the team and their counts summed, so the response size is bounded by what is open.
- `GET /api/graph/search?q=` ranks teams, people, services and links for the command palette, using the hybrid retriever from section 6.

### The view

- Canvas: `@xyflow/react` with `elkjs` layered layout and hierarchical compound nodes, as in the CostGraph context page. No new graph library.
- The org tree is the backbone: CaptainMorgue at the top, teams as nested, collapsible groups, people inside them. Top-level teams start open, deeper ones closed.
- Arcs between teams for `depends_on`, `calls`, `uses`, `messaged` and `shared_incident`, styled per `means`. Lines are hidden at rest. Hovering a team shows its arcs and labels and fades the rest; the selected team keeps its arcs.
- Layer toggles per `means` filter the returned links on the client.
- Inspector for the selected team or arc: members and manager, owned services, and the evidence behind each link.
- URL state: `?start&end&focus=<id>&open=<ids>`, so a shared link reopens the same view.
- The web app renders counts it is given and does no math.

## 10. Reading outside systems

- CaptainMorgue holds the MCP connections to Dash0 and Radar. People use them through their own agent, and every read lands in the record.
- MCP first. When MCP cannot answer, for example a bulk export or a join across sources, the model writes code against the service's API. The code runs in a sandbox, and the code itself goes into the record.
- Deep telemetry questions go to Dash0 Agent0 through `runTask`.
- Everyone in the incident can see everything CaptainMorgue reads. Per-person limits come later.

## 11. The demo

Setup: a small microservice app in `team-captainmorgue` (frontend, checkout, payments, a CloudNativePG database) with fault switches, instrumented to Dash0, team labels on every workload, the app repository with Gitar installed, and one seeded past record.

1. CaptainMorgue flips a fault switch that crashes the checkout service. The restarts and retries take down the database, and payments fails next.
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
| Demo world | App with fault switches, cluster repo and Argo CD, Dash0 and Radar Cloud, Gitar, seeded record, recorded fallback | The fault reproduces on demand and resets cleanly. |

Suggested order: service core and agent first, since everything depends on events flowing; then the web app and demo world in parallel; intelligence last, layered on real events.

## 13. Open

- What happens to a running incident if the CaptainMorgue service is down? A reasonable hackathon answer: agents buffer events locally and replay them with their `seq` when it returns.
- Must a person picked as manager by a vote accept?
- What happens to a one-person team directly under CaptainMorgue?
- The conflict rule's window length.
- Whether Agent0's findings are copied into the record or linked, and who watches its credits.
