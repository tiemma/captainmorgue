# Emmanuel (tiemma): service and plugin

## Now
Reviewing `docs/dispatch.md` (messaging, raft-style elections, liveness) before building the inbox. Crew agents still on `feat/service-intel` and cluster `feat/infra`.

## Done
- Project hooks: team context on every prompt, ledger reminder on stop (`.claude/settings.json`).
- `docs/dispatch.md`: draft architecture for message delivery, team elections, non-responding members.
- Plugin: hooks, `/captainmorgue:broadcast`, `scripts/replay.sh` (merged to `main`).
- Fix: no conflict raised against an earlier conflict event.
- Service: `/events`, `/broadcast`, `/stream`, `/record`, roster, conflict rule, serves `web/` (merged to `main`).
- `compose.yaml` with a local Elasticsearch 9.5.5 for testing.
- Plan, contract and owners in `docs/hackathon-plan.md`.

## Next
- Answer the open questions in `docs/dispatch.md` section 9, then build `/messages`, `/inbox`, heartbeats and the election.
- Review and merge `feat/service-intel`, publish `ghcr.io/tiemma/captainmorgue`.
- Review `feat/infra` in the cluster repo and hand it to Sammy.

## Blocked on
- Nothing.

## Handing off
- Sammy: `feat/infra` in `tiemma/captainmorgue-cluster` (conference app, CaptainMorgue as `app`, Elasticsearch, Dash0) once I have reviewed it.
- Jubril: `web/index.html` is `docs/demo.html`; wire it to `/stream`. Test with `scripts/replay.sh`.
