# CaptainMorgue PRD

Status: hackathon draft | Owner: Emmanuel Bakare | Related: Dash0 (observability), Radar (Kubernetes clusters)

Tagline: **Where incidents go to die.**

## 1. Summary

- When an incident pulls in several people, nobody has the whole picture. Each responder works in their own terminal and dashboards, decisions are made in parallel, and two people can undo each other's work without knowing. The timeline is rebuilt from memory afterwards.
- CaptainMorgue gives every responder an agent on their laptop and coordinates all of them through one incident. It records what each person did, how far that moved the incident, and how it relates to everyone else's decisions.
- Responders are organised as a tree of teams, each with one manager. Status flows up to managers, work is dispatched down, and CaptainMorgue sits at the top with the full record.
- CaptainMorgue acts on its own. It pulls in the teams an incident affects, decides who needs to hear each message, and catches conflicting actions.
- This is a hackathon build. CaptainMorgue proves itself by injecting faults into a demo cluster, starting a real incident, and handling it end to end in front of the judges.
- When the incident ends, the record is already written: a timestamped log, how each part was resolved, and the improvements that stop it coming back.
- Applications run on Kubernetes, and everything else is reached from the cluster. CaptainMorgue reads the cluster through Radar and telemetry through Dash0.
- Out of scope for now: images, audio and video in the record, and systems that cannot be seen from Kubernetes.

## 2. Decision log

| # | Question | Decision |
|---|----------|----------|
| 1 | Who has an agent? | Every responder. Each person's agent runs on their laptop and is tied to their identity, so every action in the record has a named person behind it. |
| 2 | How are responders organised? | A tree of teams. A team holds people and sub-teams (Team A, inside it Team B, inside that a person), and a team can also have people of its own alongside its sub-teams. |
| 3 | Who manages a team? | Exactly one manager per team, usually the first person to join or be assigned. A manager is also a responder and can do work. |
| 4 | Is the incident manager special? | No. The incident manager is an ordinary manager at the top of the tree. |
| 5 | How does information move? | Status and the record go up the tree to each manager. Work is dispatched down. Each manager holds the ordered record for their own team and everything below it, and passes it up. |
| 6 | Where does CaptainMorgue sit? | At the top of the tree. It receives everything from every team, so it always holds the full record of the incident. |
| 7 | How do people reach each other? | Anyone can send a message to CaptainMorgue, and it decides who should receive it: a person, a manager or a whole team. People can also @mention each other. Every dispatch passes through CaptainMorgue, so it manages every interaction and the record has all of them. |
| 8 | Who sees the incident? | Everyone involved sees the current status and the running record. |
| 9 | What does CaptainMorgue do on its own? | Pulls in affected teams, chooses who receives each message, and flags actions that conflict with another person's decision. |
| 10 | What happens when a manager drops off? | The team holds a vote. Team members and CaptainMorgue vote, and a majority picks the new manager. CaptainMorgue's vote means a team of two can still choose a manager when one person is gone. |
| 11 | What about a team of one? | It is not a team. That person joins the team above. |
| 12 | How does CaptainMorgue read systems? | CaptainMorgue holds the connections to Radar, Dash0 and other services. Each person uses them through their own agent, so every lookup lands in the record. Agents use each service's own agent tools first. They write and run code against a service's API only when those tools cannot answer, and that code is kept in the record. |
| 13 | Who answers deep telemetry questions? | Dash0 Agent0. CaptainMorgue hands it the question and brings the answer back into the incident. |
| 14 | Where do workloads run? | On Kubernetes. Databases, SaaS and cloud services are reached from the cluster, so every investigation starts there. |
| 15 | What goes in the record? | Text at launch. Images, audio and video come later. |
| 16 | What is fault injection for? | Testing CaptainMorgue. It breaks a demo cluster on purpose, so the demo shows a real incident from the first alert to the finished record and proves CaptainMorgue works. It is a test harness, not a feature responders use. |
| 17 | What is the agent on each laptop? | A Claude Code plugin. Responders already work in Claude Code, and the plugin sees every command and tool call the agent makes. |
| 18 | What goes into the record? | Everything a person does: what their agent runs and reads, the commands they type, and the messages they send through their agent. |
| 19 | Where are the screens? | A web app. One shared page shows the live tree, timeline, relay feed and record, and it goes on the big screen in the demo. |
| 20 | Who is in the demo? | All real people, each on their own laptop with their own agent. CaptainMorgue shows the event log across all agents as the incident proceeds, streaming logs and other artifacts live. |
| 21 | How does an incident start? | Three ways: a Dash0 alert fires, a person declares one from their agent, or a fault injection opens it. In the demo, the injected fault trips a Dash0 alert and CaptainMorgue opens the incident from that. |
| 22 | How do people join? | CaptainMorgue pulls them in. It picks people from service ownership, and their agent gets a prompt to join with the team already set. Later, CaptainMorgue reads PagerDuty to know who is on call for each team. |
| 23 | Which chat is in the record? | Messages sent through the agents: @mentions and broadcasts through CaptainMorgue. No outside chat tool is read. |
| 24 | Sponsor technology | The build uses Elasticsearch, Dash0, A2A, Gitar and Radar. Section 7 says how each one is used. |

## 3. What people see

### 3.1 Joining an incident

- A responder's agent joins the incident and places them in their team. The first person in a team becomes its manager.
- CaptainMorgue pulls in the teams the incident affects and tells their people why they were called.

### 3.2 During the incident

- **Who is on it.** A live tree of every team and person, with each person's current state and when they last made progress. Anyone who has gone quiet stands out. Managers see this first.
- **What happened, in order.** One timeline across everyone, on a shared clock, separating actions, decisions and resolved parts. Anyone can scroll it back to the first minute.
- **Conflicts.** When one person's action works against another person's decision, such as restarting pods during a rollback, CaptainMorgue tells both of them and their managers before it does damage.
- **Who was told, and why.** Every message CaptainMorgue relays shows who received it and the reason it chose them, so people can trust the routing and correct it when it is wrong.
- **What is still open.** The incident split into parts, each with an owner, progress and, once closed, how it was resolved. A part can close while the incident stays open.
- **Evidence.** Cluster detail from Radar, telemetry from Dash0, and Agent0's findings appear in the incident as they arrive, with links back to the source.

### 3.3 When a manager drops off

- The team sees that its manager is gone, and that a vote is running.
- The new manager takes over the team's record where the last one left it. Nothing in the record is lost.

### 3.4 When it ends

- The record is written from the timeline, not from memory. It covers when the incident opened and was resolved, who was involved, how each part was resolved, and any conflicts.
- Improvements come out of the record, each with an owner. Every line links back to the moment in the timeline it came from.

### 3.5 The demo

- CaptainMorgue injects a fault into the demo cluster. The fault shows up in Dash0 and Radar like a real incident would.
- Several real people, each on their own laptop with their own Claude Code agent, join and work the incident live. The web app on the big screen streams the event log across every agent as they go, with logs and other artifacts as they arrive. CaptainMorgue pulls in the right teams, relays messages, and flags a conflict.
- The fix goes out as a pull request. Gitar reviews it and confirms CI is green, and the incident is resolved.
- The record is on screen at the end, written from the timeline. It shows a past incident found in Elasticsearch, and its improvements open as pull requests for Gitar to check.

## 4. Hackathon scope

Proposed, for review. The demo needs, in order:

1. **Shared record.** Agents on laptops, the team tree, managers, the live tree and the timeline. CaptainMorgue receives and keeps everything. Text only.
2. **Routing.** Messages to CaptainMorgue relayed to the right people with the reason shown, plus @mentions and dispatch.
3. **Evidence.** Radar and Dash0 connections, and the Agent0 hand-off.
4. **Fault injection** on the demo cluster, to start the incident.
5. **The record** at the end.

After the hackathon: manager votes, conflict flags beyond the demo case, improvements tracked to done, and "this has happened before".

## 5. Success

Proposed, for review.

- The demo runs end to end: an injected fault, several people and their agents working it, and a resolved incident with its record on screen.
- Every action in the record has a person and a time behind it.
- The record is complete without anyone writing it up.

## 6. Open questions

| #   | Question                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Which faults the demo injects, on which cluster, and how the cluster is reset between demo runs.                                                                   |
| 2 | How CaptainMorgue knows who owns a service: service catalog, code ownership files, on-call schedules or past incidents.                                            |
| 3 | What happens to the incident if CaptainMorgue itself is unavailable.                                                                                               |
| 4 | Whether agents may ever talk to each other directly without CaptainMorgue, and how such talk would reach the record.                                               |
| 5 | Whether a person sees only what they could see on their own in Radar and Dash0, or everyone in the incident sees everything.                                       |
| 6 | Whether a person's raw activity (commands and output) stays private, with only a summary going up. Who outside the incident can read the record once it is closed. |
| 7 | Whether a person picked as manager by a vote must accept, and who takes it if they do not respond.                                                                 |
| 8 | What happens to a team of one directly under CaptainMorgue, which has no team above to join.                                                                       |
| 9 | Whether Agent0's findings are copied into the record or only linked. Who watches Agent0 credit use, and what happens when it runs out mid-incident.                |
| 10 | Whether finding "this has happened before" is in the first release.                                                                                                |
| 11 | Who closes the incident: CaptainMorgue or a manager.                                                                                                               |
| 12 | Whether improvements are only suggested, or also filed and tracked to done.                                                                                        |
| 13 | Whether CaptainMorgue is part of CostGraph or a separate product.                                                                                                  |
| 14 | Which other incident tools it connects to after the hackathon (PagerDuty for on-call is planned; chat and status page are open), or whether it replaces them.                                                                      |
| 15 | How CaptainMorgue judges how much a step moved the incident forward. |
| 16 | How CaptainMorgue spots that two actions conflict. For the demo, one written rule for the scripted case may be enough. |
| 17 | The demo script: which fault, who does what, where the conflict happens, and when the record appears. |
| 18 | The fallback if the live demo fails: a recorded run, a local copy of the services, or both. |
| 19 | Who CaptainMorgue is for, and why existing incident tools (incident.io, Rootly, PagerDuty, Radar Cloud, Dash0 Agent0) do not already do this. |
| 20 | The hackathon itself: judging criteria, deadline and team size. |
| 21 | How secrets in recorded commands and output are kept out of the record. |

## 7. Sponsor technology

| Technology | What it does in CaptainMorgue |
|---|---|
| Dash0 | Starts incidents: an alert opens one. Agents read telemetry through its MCP server, and deep questions go to Agent0. The demo fault shows up here first. |
| Radar | Shows the cluster: topology, Kubernetes events and what changed, read by agents through its MCP server. Its event timeline feeds the incident record, and the web app links to Radar views as evidence. |
| Elasticsearch | Stores the incident record and makes it searchable. Search over past records is how CaptainMorgue spots "this has happened before" and finds who fixed it last time. |
| A2A | How agents talk to each other and to CaptainMorgue. Each person's agent describes what it can do, and dispatched work moves as A2A tasks whose state is the status that flows up the tree. |
| Gitar | Verifies the fix. When a part of the incident is fixed in code, Gitar reviews the pull request, separates real CI failures from flaky ones, and confirms CI is green before it ships. Its findings land in the record, and improvements from the record become pull requests that Gitar checks. |

The architecture document will follow as a sibling of this PRD.
