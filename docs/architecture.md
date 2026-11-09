# CaptainMorgue architecture

Status: hackathon draft | Companion to [prd.md](prd.md) | Diagram: [captainmorgue-map.html](captainmorgue-map.html)

The PRD says what CaptainMorgue does. This doc says how it is built. Decisions here come from the PRD decision log; anything not yet settled is in section 8.

## 1. Components

| Component | Runs where | Job |
|---|---|---|
| Agent | Claude Code plugin on each responder's laptop | Tied to the person's identity. Captures what the person and the agent do, sends it to CaptainMorgue, and receives dispatched work and relayed messages. |
| CaptainMorgue | Central hosted service | Root of the team tree. Handles every dispatch event, routes messages, holds the connections to outside services, keeps the full record, and votes in manager elections. |
| Web app | Browser, on the big screen in the demo | Live team tree, timeline, relay feed, workstreams and the finished record. Streams the event log across agents as it happens. |
| Elasticsearch | Hosted | Store for the incident record. Search over past records finds "this has happened before". |
| Dash0 | SaaS | Alerts that open incidents, telemetry over its MCP server, deep questions handed to Agent0. |
| Radar | In the demo cluster | Kubernetes topology, events and changes over its MCP server. |
| Gitar | On the GitHub repository | Reviews fix pull requests and confirms CI is green before they ship. |
| Demo cluster | Kubernetes | Where applications run and where faults are injected. Everything outside the cluster is reached from inside it. |

## 2. Team tree

- Teams nest. A team holds people and sub-teams, and has exactly one manager.
- The first person to join or be assigned to a team becomes its manager. The incident manager is the manager at the top and has no special powers.
- A team of one is folded into the team above.
- CaptainMorgue sits above every top-level team.

## 3. Messaging

- Agents talk to each other and to CaptainMorgue over A2A (Agent2Agent).
- Each agent publishes an A2A agent card that describes what it can do. CaptainMorgue routes on the cards plus service ownership.
- Dispatched work is an A2A task. Task states (working, input required, completed, failed) are the status that flows up the tree.
- Every dispatch is an event, and CaptainMorgue handles every event. People send @mentions and broadcasts through their agent to CaptainMorgue, which picks the recipients and records why it picked them.

## 4. The record

- Each manager keeps the ordered log for its own subtree. Every entry carries a sequence number from that subtree, so the order can be replayed even though Elasticsearch itself does not order writes.
- Subtree logs are gossiped up to CaptainMorgue, which keeps the full record.
- The record is stored in Elasticsearch. Text only for now. Images, audio and video come later.
- What is captured: everything the agent runs and reads, commands the person types, and messages sent through agents. No outside chat tool is read.
- When an incident closes, the record is written from the timeline: how each part was resolved, conflicts, and improvements with owners.

## 5. Manager election

- When a manager drops off, the team elects a new one, Raft-style.
- The voters are the team's members plus CaptainMorgue. A two-person team with one person gone still has a majority, two of three.
- The new manager takes over the subtree log from CaptainMorgue's copy.

## 6. Reading outside systems

- CaptainMorgue holds the connections to Dash0, Radar and other services. People use them through their own agent, so every read lands in the record.
- Agents read through MCP servers first. They generate code against a service's API only when MCP cannot answer, for example a bulk export or a join across sources. That code runs in a sandbox, and the code goes into the record.
- Deep telemetry questions go to Dash0 Agent0 through `runTask`.

## 7. Incident lifecycle in the demo

1. CaptainMorgue injects a fault into the demo cluster. The injection only tests CaptainMorgue; it is not a feature responders use.
2. A Dash0 alert fires and CaptainMorgue opens the incident. A person can also declare one from their agent.
3. CaptainMorgue works out which teams own the affected services and pulls their people in. Each agent gets a join prompt with the team already set.
4. People work the incident through their agents. Status and logs stream to the web app, and CaptainMorgue relays messages and flags conflicting actions.
5. The fix ships as a pull request that Gitar reviews and confirms green.
6. The incident closes and the record appears, with any matching past incident found in Elasticsearch.

## 8. Open

- Is Elasticsearch the store of record, or a search index over a log kept elsewhere? Keyword search, semantic search, or both?
- Can agents call each other directly over A2A without CaptainMorgue? If so, how do those calls reach the record?
- What happens to a running incident if CaptainMorgue is down?
- How are secrets in recorded commands and output redacted before storage?
- Does CaptainMorgue limit each person to what they could read on their own, such as their Kubernetes access or Dash0 dataset?
- How are conflicting actions detected? One hand-written rule for the demo case may be enough.
- How is a step's progress scored?
