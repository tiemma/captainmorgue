# Jubril: wall screen

## Now
15:00 - Postmortem library backend audit complete on main 7f93997; archive list/detail and summary exposure need Emmanuel/team API work.

## Start here (from Emmanuel, 15:20)

### Get on the live incident (5 minutes)
1. Install: in Claude Code run `/plugin marketplace add tiemma/captainmorgue`, then `/plugin install captainmorgue@captainmorgue`. Needs `jq` and `curl` (Windows: Git Bash or WSL, plus `winget install jqlang.jq`).
2. Env (shell profile or `~/.claude/settings.json` "env"): `CM_URL=https://captainmorgue.cnh.radarhq.io`, `CM_ACTOR=<your GitHub login>`, `CM_TEAM=registration`, `CM_LEDGER=jubril`, `CM_ROLE=scribe`. No token needed.
3. In Claude Code: `/captainmorgue:join`, then `/captainmorgue:status team`. Send one ask to Emmanuel (`/captainmorgue:ask @tiemma ...`) and answer whatever comes back. Tick the milestone below.
4. Then follow `docs/runbooks/` (README has the cast; you are the registration scribe).

### What CaptainMorgue supports today (all on `main`)
| Feature | How you use it | What the wall screen should show |
|---|---|---|
| Join / leave | `/captainmorgue:join [team] [commander\|responder\|scribe] [task]`, `/captainmorgue:leave` | person appears under their team; everyone already in gets a "joined" message |
| Roles and profile | `CM_ROLE`, `CM_TASK`, `CM_REPO`, `CM_TOOLS`; `/captainmorgue:task <text>` mid-incident | COMMANDER / SCRIBE / MGR badges, task in grey, repo and tools on hover |
| One commander | first to join as commander holds it; later ones join as responder | commander in the header |
| Team managers | first online joiner manages; elected by term when the manager goes offline | MGR badge, term |
| Liveness | poller heartbeats every 5 s; suspect at 15 s, offline at 30 s | online / suspect / offline dots |
| Asks and replies | `/captainmorgue:ask @person-or-team ...`, `/captainmorgue:reply <seq> <text>` | sent / delivered / seen per recipient |
| Broadcasts | `/captainmorgue:broadcast root ...` (everyone), `... <team> ...` | relay row with who got it and why |
| Busy auto-reply | unanswered ask gets the person's current task after 60 s, then escalates | auto-reply and escalation rows |
| Catch-up digest | automatic on join or return | a `digest` row (needs a label, see Next) |
| Claim before cluster write | automatic: kubectl/helm/argo/Radar writes claim `ns/kind/name`; a second person's write is blocked naming the holder | Claims panel; conflict panel |
| Conflicts | two people act on the same resource | conflict interrupt panel |
| Status | `/captainmorgue:status`, `status @person`, `status team` | |
| Notifications | macOS, Linux (notify-send), Windows (tray balloon) | |
| Record | written at close (Claude) | Record tab |

Coming from agents now: asks shown in the chat with an interactive picker plus `cm console` (feat/asks), bundled Dash0/Radar MCP plus `cm doctor` (feat/mcp).

### Run it locally
```bash
git pull
cd service && ROSTER=../roster.yaml WEB_DIR=../web go run .      # http://localhost:8080
env -u CM_URL scripts/e2e.sh                                       # must print ALL PASSED before any merge
```
`CM_URL` pointing at the live service makes e2e hit production; always unset it for e2e.

## Done
- 15:02 - Sent Emmanuel (tiemma) a direct CaptainMorgue ask, seq 9, requesting ownership and API contract for the postmortem library. List plus complete historical document is the hackathon priority; frontend remains ours. Awaiting reply.
- 15:00 - Reviewed postmortem support on main 7f93997: current-incident record exists; historical list/detail do not. Generated summary/fixed_by are stored but absent from GET record. No backend changes.
- 14:54 - Typography (309cf23), inline panel (f61b6cb) and chronological timeline (e49a35e) integrated. Final app and static Storybook builds pass; all 14 browser tests pass, including inspector pointer/keyboard persistence, progressive disclosure, active/closed timeline and reduced motion. Desktop/mobile screenshots inspected; no overflow.
- 14:49 - Main merged through 1eb6d6e (65009a7); preserved Emmanuel's plugin auto-install handoff. No backend or deployment changes.
- 14:49 - 2991fc0 and cbb286d add CostGraph app patterns, progress states and agent approval workflows. 8ceb978 adds Requests/Record labels, closed Evidence/History/Details disclosures, and lifecycle stories. b4bcba5 adds 11 passing browser tests.
- 14:49 - Local service/plugin E2E passed all 8 checks on bfcb853; no live incident was mutated. Latest main changes the E2E token check and docs only.
- 14:34 - Local Storybook runs at :6006; app and static Storybook builds pass. Screen/setup commits f4d43d7 and 7a189d2 on docs/frontend-design-plan. Browser checks initially 5/6; dialog focus fix and agent-first redesign in progress.
- 14:34 - Pulled main through bfcb853; coordination, receive plugin and live-wall handoff reviewed.
- 14:34 - Codex hooks committed at 6183e68, fixture tests pass; manual context hook loaded team updates. Automatic execution still requires client hook trust.
- 14:00 - Drafted docs/frontend-design-plan.md on docs/frontend-design-plan after pulling main at 7ebf17f. Reviewed CostGraph live reference and local source with three research agents. No frontend implementation yet.

## Next
- [ ] **Install the plugin automatically** (from Emmanuel, 14:40). Today each person runs `/plugin marketplace add` and `/plugin install` by hand. Make it automatic: in `.claude/settings.json` of this repo and of `tiemma/captainmorgue-cluster`, add `extraKnownMarketplaces` (`captainmorgue` -> GitHub `tiemma/captainmorgue`) and `enabledPlugins` (`"captainmorgue@captainmorgue": true`), so anyone who opens either repo in Claude Code and trusts it is offered the plugin. Check the exact keys in the Claude Code settings docs, test it in a fresh clone, and update the milestone steps in AGENTS.md.
- [ ] Milestone: set up on my agent once deployed, using the instructions in AGENTS.md; not completed by this frontend preview work.
- Review the updated Storybook and wire the agreed screens to the live service. Browser action ownership stays with Emmanuel/team; all responders may act in the demo.
- Take over the live wall screen (merged to main from feat/web-live, renders from /stream). Check state.people objects, teams[].term and deliveries keyed by seq. Fix the truncated Ticketing and Payments label and sticky last-actor highlight.
- Verify live record rendering and asynchronous record readiness against the latest service.
- [ ] Wall screen polish on the live page (already wired to `/stream`): labels for `join`, `digest`, `claim`, `task` events; check the new Claims panel and role badges in a browser at 1440 px and on a projector; nothing computed client-side.
- [ ] Teams view: the hard-coded team graph was removed with the demo data. If wanted, draw it from `state.teams` (teams, managers, members, `owns`).

## Blocked on
- Full browser actions still need claim/resolve/close contracts; join, inbox, messaging and elections have now landed on main.

## Handing off
- Emmanuel: P0 coordination and live-wall handoffs received. Code review confirms seen stops timeout even without a reply; please reconcile with dispatch 5b. Browser approval is not an existing backend state; it stays a labeled sample flow in Storybook. Storybook is separate under frontend/, with local sample interactions; no collision with web/index.html. Browser action gaps and reply/readiness questions are tracked in docs/frontend-design-plan.md.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.

- Emmanuel: Postmortems library needs a paginated list of stored records and historical detail by incident ID, including summary, resolution parts, fixed_by, improvements/owners, timestamps and timeline events. Current GET /record/{id} accepts only current incident and omits summary/fixed_by. Please expose generation readiness/error and restore generated record fields after restart. Service currently defaults to one INCIDENT_ID; unique incident IDs are needed to avoid overwriting archive documents. This is a requested contract addition, not implemented frontend/backend behavior.
