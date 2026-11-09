# Jubril: wall screen

## Now
Not started.

## Done

## Next
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Take over the live wall screen (merged to `main` from `feat/web-live`, renders from `/stream`). Check it against `feat/coord` once that merges: `state.people` objects, `teams[].term`, `deliveries` keyed by seq. Fix: "Ticketing and Payments" truncates in the tree column; highlight sticks on the last actor.
- Wire `web/index.html` to `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render tree, parts, relay, conflict, investigation and signals. Remove the playback controls.
- Record tab reads `/record/INC-1`; "happened before" card shows `past_match`.

## Blocked on

## Handing off
