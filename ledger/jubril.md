# Jubril: wall screen

## Now
Not started.

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

## Next
- [ ] **Install the plugin automatically** (from Emmanuel, 14:40). Today each person runs `/plugin marketplace add` and `/plugin install` by hand. Make it automatic: in `.claude/settings.json` of this repo and of `tiemma/captainmorgue-cluster`, add `extraKnownMarketplaces` (`captainmorgue` -> GitHub `tiemma/captainmorgue`) and `enabledPlugins` (`"captainmorgue@captainmorgue": true`), so anyone who opens either repo in Claude Code and trusts it is offered the plugin. Check the exact keys in the Claude Code settings docs, test it in a fresh clone, and update the milestone steps in AGENTS.md.
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- [ ] Wall screen polish on the live page (already wired to `/stream`): labels for `join`, `digest`, `claim`, `task` events; check the new Claims panel and role badges in a browser at 1440 px and on a projector; nothing computed client-side.
- [ ] Teams view: the hard-coded team graph was removed with the demo data. If wanted, draw it from `state.teams` (teams, managers, members, `owns`).

## Blocked on

## Handing off
