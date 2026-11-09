# Jubril: wall screen

## Now
Not started.

## Start here (from Emmanuel, 14:35)
The wall screen is already live-wired on `main` (`web/index.html`); you own it from here. Run it locally:

```bash
git pull
cd service && ROSTER=../roster.yaml WEB_DIR=../web go run .      # terminal 1, http://localhost:8080
open http://localhost:8080
```

Before every merge: `scripts/e2e.sh` must print ALL PASSED. Then do the set-up-your-agent milestone below as soon as Sammy's ledger says deployed.

## Done

## Next
- [ ] **Install the plugin automatically** (from Emmanuel, 14:40). Today each person runs `/plugin marketplace add` and `/plugin install` by hand. Make it automatic: in `.claude/settings.json` of this repo and of `tiemma/captainmorgue-cluster`, add `extraKnownMarketplaces` (`captainmorgue` -> GitHub `tiemma/captainmorgue`) and `enabledPlugins` (`"captainmorgue@captainmorgue": true`), so anyone who opens either repo in Claude Code and trusts it is offered the plugin. Check the exact keys in the Claude Code settings docs, test it in a fresh clone, and update the milestone steps in AGENTS.md.
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Take over the live wall screen (merged to `main` from `feat/web-live`, renders from `/stream`). Check it against `feat/coord` once that merges: `state.people` objects, `teams[].term`, `deliveries` keyed by seq. Fix: "Ticketing and Payments" truncates in the tree column; highlight sticks on the last actor.
- Wire `web/index.html` to `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render tree, parts, relay, conflict, investigation and signals. Remove the playback controls.
- Record tab reads `/record/INC-1`; "happened before" card shows `past_match`.

## Blocked on

## Handing off
