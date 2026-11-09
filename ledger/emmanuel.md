# Emmanuel (tiemma): service and plugin

## Now
Reviewing `docs/dispatch.md` (messaging, raft-style elections, liveness) before building the inbox. Crew agents still on `feat/service-intel` and cluster `feat/infra`.

## Done
- `feat/infra` pushed to the cluster repo for Sammy (26bfbe8): conference app, confdb, CaptainMorgue as `app`, OTel collector to Dash0. Elastic Cloud chosen (ELSER does not fit the budget); Dash0 operator skipped (needs hostPath).
- Dash0 token verified: region us-west-2, OTLP endpoint `ingress.us-west-2.aws.dash0.com:4317`.
- Review decisions recorded in `docs/dispatch.md` section 9; CaptainMorgue's own connections designed in 5a.
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
- Sammy: `feat/infra` in `tiemma/captainmorgue-cluster` is pushed and ready for your review and merge. Secret `dash0`: `endpoint` = `ingress.us-west-2.aws.dash0.com:4317`, `token` from Emmanuel directly (never in git). Secret `captainmorgue` needs Elastic Cloud URL and key. CaptainMorgue image `ghcr.io/tiemma/captainmorgue` is not published yet; `feat/service-intel` adds the build workflow.
- Jubril: `web/index.html` is `docs/demo.html`; wire it to `/stream`. Test with `scripts/replay.sh`. Wall screen also shows sent / delivered / seen per recipient (dispatch section 9).
