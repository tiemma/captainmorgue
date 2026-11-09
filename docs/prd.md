# CaptainMorgue PRD

Status: hackathon draft (Cloud Native Hackathon, Radar AI SRE track, demo at 5:30 on 2026-11-09) | Owner: Emmanuel Bakare | Related: Dash0 (observability), Radar (Kubernetes clusters)

Tagline: **Where incidents go to die.**

## 1. Summary

- When an incident pulls in several people, nobody has the whole picture. Each responder works in their own terminal and dashboards, decisions are made in parallel, and two people can undo each other's work without knowing. The timeline is rebuilt from memory afterwards.
- CaptainMorgue gives every responder an agent on their laptop and coordinates all of them through one incident. It records what each person did, how far that moved the incident, and how it relates to everyone else's decisions.
- Responders are organised as a tree of teams, each with one manager. Status flows up to managers, work is dispatched down, and CaptainMorgue sits at the top with the full record.
- CaptainMorgue acts on its own. It pulls in the teams an incident affects, decides who needs to hear each message, and catches conflicting actions.
- This is a hackathon build for the Cloud Native Hackathon's Radar AI SRE track. The judges want a project running on Kubernetes with Radar used throughout, a Radar AI investigation of a real issue, and something that makes conferences easier. They also ask teams not to break things on purpose for the demo.
- The conference angle: a conference is a pile of systems run by different teams (registration and check-in, the schedule, ticketing and payments, streaming, venue wifi) that all fail at the worst moment. CaptainMorgue is the incident desk for the organisers: it pulls in the right team, keeps everyone's agents in one record, and writes the record so next year's event does not repeat it. The demo app is a small conference app run by three teams.
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
| 16 | What is fault injection for? | Testing CaptainMorgue before the demo. Bounded fault switches in the demo app let us rehearse a full incident and check every part of CaptainMorgue works. They are not used in the judged demo, which shows a real issue instead (decision 44). |
| 17 | What is the agent on each laptop? | A Claude Code plugin. Responders already work in Claude Code, and the plugin sees every command and tool call the agent makes. |
| 18 | What goes into the record? | Everything a person does: what their agent runs and reads, the commands they type, and the messages they send through their agent. |
| 19 | Where are the screens? | A web app. One shared page shows the live tree, timeline, relay feed and record, and it goes on the big screen in the demo. |
| 20 | Who is in the demo? | All real people, each on their own laptop with their own agent. CaptainMorgue shows the event log across all agents as the incident proceeds, streaming logs and other artifacts live. |
| 21 | How does an incident start? | Three ways: a Dash0 alert fires, a person declares one from their agent, or a fault injection opens it. In the demo, the injected fault trips a Dash0 alert and CaptainMorgue opens the incident from that. |
| 22 | How do people join? | CaptainMorgue pulls them in. It picks people from service ownership, and their agent gets a prompt to join with the team already set. Later, CaptainMorgue reads PagerDuty to know who is on call for each team. |
| 23 | Which chat is in the record? | Messages sent through the agents: @mentions and broadcasts through CaptainMorgue. No outside chat tool is read. |
| 24 | Sponsor technology | The build uses Elasticsearch, Dash0, A2A, Gitar and Radar. Section 7 says how each one is used. |
| 25 | Which fault does the demo inject? | A cascading failure that needs several teams to work together. The app crashes, the load takes down the database, and the failure spreads to the services that depend on it. Each team owns a different part, so routing, relays and conflicts all show up. |
| 26 | How are conflicting actions spotted? | Two checks together. A rule flags two people acting on the same Kubernetes resource within a short window when one of the actions is a write. The model also checks each new action against earlier decisions, confirms or dismisses what the rule flagged, and explains why in plain words. |
| 27 | How is progress judged? | By signal recovery. A step counts as progress when the alerting signal in Dash0, such as error rate or latency, moves back toward normal after it. |
| 28 | What if the live demo fails? | Switch to a recorded run of a full rehearsal. |
| 29 | How does CaptainMorgue know who owns a service? | It combines four sources: team labels on Kubernetes workloads read through Radar, the Dash0 service catalog, CODEOWNERS in the repository, and who fixed it in past incidents stored in Elasticsearch. |
| 30 | Who closes the incident? | Any of three ways. CaptainMorgue proposes closing once signals recover and every part is resolved, and the top manager confirms. CaptainMorgue closes it alone once signals stay normal for a set time. Any manager can close it. |
| 31 | What happens to improvements? | Code improvements open as pull requests that Gitar reviews. The rest become issues with owners. |
| 32 | Is "this has happened before" in the hackathon build? | Yes. Elasticsearch is seeded with an earlier record of a similar failure, so the match appears in the demo. |
| 33 | What can each person see? | Everything. During the hackathon, everyone in the incident sees all Radar and Dash0 data through CaptainMorgue. Limiting each person to their own access comes later. |
| 34 | Is raw activity private? | No. Raw commands and output are visible to everyone in the incident, and anyone in the organisation can read the closed record. |
| 35 | How are secrets kept out of the record? | Scrubbed twice: the plugin removes known secret patterns (tokens, keys, connection strings) before anything leaves the laptop, and CaptainMorgue scrubs again before storing. |
| 36 | Can agents talk directly? | No. Every interaction between agents goes through CaptainMorgue as an event, so the record is complete. |
| 37 | How do people get into the team tree? | At onboarding. After signing in, a person picks the team they belong to. They join a manager in one of two ways: as a member of that manager team, or as the manager of a new sub-team under it. A manager names the parent team their team belongs to. |
| 38 | How does the onboarded tree relate to incidents? | Incidents use the onboarded tree and its managers by default. First-to-join becomes manager only when a team manager is not in the incident, and elections still cover a manager who drops off. |
| 39 | How are relationships between teams shown? | A relationship view built from what CaptainMorgue collects: the team tree as the backbone, with arcs between teams for how they relate. Hovering a team highlights its arcs. |
| 40 | What do the relationships mean? | A small fixed vocabulary: member of, manages, part of, owns, calls, uses, depends on, messaged, and shared an incident with. Each arc shows its relationship type and the evidence behind it. |
| 41 | How are demo faults kept safe? | They are switches built into the demo app, inside our own namespace and resource budget, used only in rehearsal, and they switch off instantly. The hackathon cluster refuses the privileged access chaos tools need, and the judges ask teams not to break things on purpose for the demo. |
| 42 | How does CaptainMorgue recall the past? | By meaning, not just keywords. Every event and record is embedded when it is stored, so "this has happened before", who fixed it last time, who answered a similar question, and "ask the incident" all find matches even when the wording differs. |
| 43 | Where does the demo run? | On the team cluster from the Cloud Native Hackathon starter, deployed through Git, reachable at https://captainmorgue.cnh.radarhq.io. |
| 44 | What does the judged demo show? (suggested) | A real issue. Either an incident that really happened on our cluster during the day, replayed live from its record, or a real release shipped as a canary that misbehaves and gets aborted. CaptainMorgue runs a Radar AI investigation on it and brings the findings into the record. Fault switches stay a rehearsal tool. |
| 45 | What if CaptainMorgue is down? (suggested) | Agents keep working and buffer events on the laptop with their sequence numbers, then replay them when CaptainMorgue is back, so nothing is lost and the order holds. The web app shows that it is reconnecting. One replica in the cluster; Argo CD and Kubernetes restart it. |
| 46 | Must an elected manager accept? (suggested) | No. The elected person is told they now manage the team and can hand it off with one command, which starts a new vote. |
| 47 | A one-person team directly under CaptainMorgue? (suggested) | That person reports straight to CaptainMorgue and manages themselves until someone joins. |
| 48 | What happens to Agent0 and Radar investigation findings? (suggested) | A short summary is copied into the record with a link to the full investigation, so the record stands on its own. At most one Radar AI investigation and one Agent0 run per incident part, both from the hackathon allowance. When one is unavailable, CaptainMorgue falls back to its own reads through MCP. |
| 49 | Is CaptainMorgue part of CostGraph? (suggested) | No. It is a separate hackathon project in its own repository. |
| 50 | Other incident tools after the hackathon? (suggested) | CaptainMorgue sits beside paging and chat tools, not in place of them: PagerDuty for who is on call, Slack for notifications that point back to the incident, and a status page later. |
| 51 | Who is it for, and why not existing tools? (suggested) | For any group running many systems through many teams under time pressure: conference organisers first, then platform and SRE teams whose incidents cross several teams and who already work with coding agents. incident.io, Rootly and PagerDuty coordinate people in chat but cannot see what each person and their agent actually did. Radar investigations and Dash0 Agent0 investigate for one person. Nothing coordinates many people and their agents into one ordered record, catches them working against each other, and writes the record from what happened. |
| 52 | The demo script (suggested) | About 4 minutes. 0:00 the problem: a conference runs on systems owned by different teams. 0:20 a real issue on the conference app shows in Radar and Dash0 and CaptainMorgue opens the incident, shows a matching past incident, and pulls in three teams. 1:00 responders work it from Claude Code on their own laptops while the big screen streams every event. 1:40 a broadcast gets relayed with the reason, and a conflict on the database is flagged. 2:10 one manager closes their laptop and the team elects a new one. 2:30 the Radar AI investigation findings land in the record. 3:00 the fix ships through Git, Gitar checks it, Argo CD syncs, and signals recover. 3:30 the record and the team relationship view, and improvements opened as pull requests. 4:00 close on Radar timeline and Checks before and after. |
| 53 | The hackathon (suggested) | Cloud Native Hackathon, Radar AI SRE track. Judged on: running on Kubernetes with Radar connected, Radar UI and MCP used throughout, a Radar AI investigation of a real issue, and making conferences easier. The story is due at 5:30 today. Team size is everyone with a laptop in the demo. |

## 3. What people see

### 3.0 Onboarding

- A person signs in and picks the team they belong to.
- They join a manager either as a member of that manager's team, or as the manager of a new sub-team under it. A manager names the parent team their team belongs to.
- The result is the standing team tree that every incident starts from.

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

### 3.2a How teams relate

- One view shows how teams relate, built from what CaptainMorgue collects across incidents and from the services each team owns.
- The team tree is the backbone. Arcs between teams show how they relate: one team's services call, use or depend on another's, the teams messaged each other, or they shared an incident.
- Each arc names its relationship and shows the evidence behind it, such as the calls seen in traces or the incidents they shared. Hovering a team highlights its arcs.

### 3.3 When a manager drops off

- The team sees that its manager is gone, and that a vote is running.
- The new manager takes over the team's record where the last one left it. Nothing in the record is lost.

### 3.4 When it ends

- The record is written from the timeline, not from memory. It covers when the incident opened and was resolved, who was involved, how each part was resolved, and any conflicts.
- Improvements come out of the record, each with an owner. Every line links back to the moment in the timeline it came from.

### 3.5 The demo

- The incident is a real one from the day, or a real release that misbehaves under a canary, not a fault switched on for the judges. A Radar AI investigation of it is part of the story.
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

If time runs short before 5:30, the demo needs only: events from two laptops streaming to the web app, one relayed broadcast with its reason, one Radar AI investigation summarised into the record, and the finished record. Everything else is a bonus.

After the hackathon: manager votes, conflict flags beyond the demo case, improvements tracked to done, and "this has happened before".

## 5. Success

Proposed, for review.

- The demo runs end to end: an injected fault, several people and their agents working it, and a resolved incident with its record on screen.
- Every action in the record has a person and a time behind it.
- The record is complete without anyone writing it up.

## 6. Open questions

None open. Decisions marked (suggested) are proposals to confirm or change.

## 7. Sponsor technology

| Technology | What it does in CaptainMorgue |
|---|---|
| Dash0 | Starts incidents: an alert opens one. Agents read telemetry through its MCP server, and deep questions go to Agent0. The demo fault shows up here first. |
| Radar | Shows the cluster: topology, Kubernetes events and what changed, read by agents through its MCP server. Its event timeline feeds the incident record, and the web app links to Radar views as evidence. |
| Elasticsearch | Stores the incident record and makes it searchable. Search over past records is how CaptainMorgue spots "this has happened before" and finds who fixed it last time. |
| A2A | How agents talk to each other and to CaptainMorgue. Each person's agent describes what it can do, and dispatched work moves as A2A tasks whose state is the status that flows up the tree. |
| Gitar | Verifies the fix. When a part of the incident is fixed in code, Gitar reviews the pull request, separates real CI failures from flaky ones, and confirms CI is green before it ships. Its findings land in the record, and improvements from the record become pull requests that Gitar checks. |

The architecture document will follow as a sibling of this PRD.
