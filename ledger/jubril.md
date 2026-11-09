# Jubril: wall screen

## Now
15:30 - Live React workspace complete and validated against latest service main7152df6. Publishing frontend; archive APIs and cluster repo write access remain external blockers.

## Start here (from Emmanuel, 15:20)

Contract: [docs/contract.md](../docs/contract.md) - every route, the `/stream` events, the full `state` shape and every event type. The wall renders; it never computes.

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
- 15:37 - Joined live INC-1 as s1ntaxe770r, registration scribe; service elected registration manager, commander tiemma. Local plugin CLI status confirms online and poller running in Codex session. Read catch-up digest. Claude hook installation and two-way ask milestone remain unverified.
- 15:30 - Real React workspace integrated in c0a9404 and a2c72f1: SSE timeline, requests/replies/broadcasts and receipts, roles/tasks/profiles, teams/managers/terms, claims/conflicts, authoritative commander, server record and explicit browser join. Agent identities retain agent-owned liveness. Production Docker build serves React with compact wall at /wall.html; local setup in docs/local-development.md. Frontend build and both real-service browser tests pass; latest service/plugin E2E ALL PASSED. Local live app :8080, hot reload :5173, Storybook :6006.
- 15:30 - Application project plugin setup69afaa1 preserves hooks and declares marketplace/enabled plugin. Matching cluster config prepared as ff503897 in /tmp/captainmorgue-cluster-plugin-setup; GitHub denied push for s1ntaxe770r. Claude trust/restart still required; own-agent milestone not claimed.
- 15:13 - Postmortems library/document/search/state stories integrated85ad7c0,4b596e7,5f7d1cd. Live wall8527101 implements Emmanuel role/task/team/claim display requests. Local service health/record and standalone preview navigation verified; frontend and Storybook builds pass; isolated service/plugin E2E ALL PASSED. Local setup documented in docs/local-development.md. All19 browser cases passed:18 in final suite plus1 rerun after concurrent trace-output collision; five Postmortems cases passed.
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
- [ ] Milestone: trust project plugin in Claude Code, restart, join/status, exchange an ask, then tick set up on my agent. Requires the actual Claude session.
- [ ] Finish cluster plugin config delivery once write access is granted; prepared commit ff503897.
- [ ] Wire Postmortems library to archive list/detail once Emmanuel supplies endpoints; samples remain in Storybook, live app states unavailable.
- [ ] Verify production rollout with Sammy after the frontend image builds.

## Blocked on
- Browser resolve/close workflows and approval lifecycle still need agreed contracts. Resource claims, join, inbox, messaging, roles and elections are on main. Postmortems archive list/detail remains pending Emmanuel.

## Handing off
- Sammy/Emmanuel (15:30): redesigned frontend now builds in the application Docker image, default /; compact wall is /wall.html. Please roll out the new application image after CI completes. Local service validation passed; Docker daemon unavailable locally, so image validation is via CI.
- Emmanuel (15:30): please grant s1ntaxe770r write access to captainmorgue-cluster or apply the matching .claude/settings.json marketplace/enabledPlugins setup from this repo. Prepared cluster commit ff503897 has [skip ci] to avoid triggering a deployment for settings only. GitHub rejected the push.
- Emmanuel: taking web/index.html for your live-wall polish requests (join/digest/claim/task labels, profile details, Claims and service-driven teams) alongside the separate Postmortems frontend. Registration/Platform are the current roster; no backend changes.
- Emmanuel: P0 coordination and live-wall handoffs received. Code review confirms seen stops timeout even without a reply; please reconcile with dispatch 5b. Browser approval is not an existing backend state; it stays a labeled sample flow in Storybook. Storybook is separate under frontend/, with local sample interactions; no collision with web/index.html. Browser action gaps and reply/readiness questions are tracked in docs/frontend-design-plan.md.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.

- Emmanuel: Postmortems library needs a paginated list of stored records and historical detail by incident ID, including summary, resolution parts, fixed_by, improvements/owners, timestamps and timeline events. Current GET /record/{id} accepts only current incident and omits summary/fixed_by. Please expose generation readiness/error and restore generated record fields after restart. Service currently defaults to one INCIDENT_ID; unique incident IDs are needed to avoid overwriting archive documents. This is a requested contract addition, not implemented frontend/backend behavior.
