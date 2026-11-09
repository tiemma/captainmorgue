# Jubril: wall screen

## Now
Not started.

## Start here (from Emmanuel, 14:35)
The wall screen is already live-wired on `main` (`web/index.html`); you own it from here. Run it locally:

```bash
git pull
cd service && ROSTER=../roster.yaml WEB_DIR=../web go run .      # terminal 1, http://localhost:8080
CM_URL=http://localhost:8080 DELAY=0.5 bash scripts/replay.sh       # terminal 2, plays the demo incident
open http://localhost:8080
```

Before every merge: `scripts/e2e.sh` must print ALL PASSED. Then do the set-up-your-agent milestone below as soon as Sammy's ledger says deployed.

## Done

## Next
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Take over the live wall screen (merged to `main` from `feat/web-live`, renders from `/stream`). Check it against `feat/coord` once that merges: `state.people` objects, `teams[].term`, `deliveries` keyed by seq. Fix: "Ticketing and Payments" truncates in the tree column; highlight sticks on the last actor.
- Wire `web/index.html` to `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render tree, parts, relay, conflict, investigation and signals. Remove the playback controls.
- Record tab reads `/record/INC-1`; "happened before" card shows `past_match`.

## Blocked on

## Handing off
