# Emmanuel (tiemma): service and plugin

## Now
Elasticsearch, Claude relay and record writer, and the image build (crew agent on `feat/service-intel`).

## Done
- Plugin: hooks, `/captainmorgue:broadcast`, `scripts/replay.sh` (merged to `main`).
- Fix: no conflict raised against an earlier conflict event.
- Service: `/events`, `/broadcast`, `/stream`, `/record`, roster, conflict rule, serves `web/` (merged to `main`).
- `compose.yaml` with a local Elasticsearch 9.5.5 for testing.
- Plan, contract and owners in `docs/hackathon-plan.md`.

## Next
- Review and merge `feat/service-intel`, publish `ghcr.io/tiemma/captainmorgue`.
- Review `feat/infra` in the cluster repo and hand it to Sammy.

## Blocked on
- Nothing.

## Handing off
- Sammy: `feat/infra` in `tiemma/captainmorgue-cluster` (conference app, CaptainMorgue as `app`, Elasticsearch, Dash0) once I have reviewed it.
- Jubril: `web/index.html` is `docs/demo.html`; wire it to `/stream`. Test with `scripts/replay.sh`.
