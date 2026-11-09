# Emmanuel (tiemma): service and plugin

## Now
Reviewing `docs/dispatch.md` (messaging, raft-style elections, liveness) before building the inbox. Crew agents still on `feat/service-intel` and cluster `feat/infra`.

## Done
- Plugin receive side merged (join, leave, status @person, inbox, broadcast, ask, reply, poller, hooks inject messages). `scripts/e2e.sh`: 8 checks, ALL PASSED on `main`.
- Merged to `main`: coordination layer (join, heartbeat, liveness, inbox, messages, replies, token auth, elections, auto-reply, escalation), Elasticsearch + Claude, live wall screen. Image `ghcr.io/tiemma/captainmorgue` is public and builds on every push to main.
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
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Answer the open questions in `docs/dispatch.md` section 9, then build `/messages`, `/inbox`, heartbeats and the election.
- Review and merge `feat/service-intel`, publish `ghcr.io/tiemma/captainmorgue`.
- Review `feat/infra` in the cluster repo and hand it to Sammy.

## Blocked on
- Nothing.

## Handing off
- Sammy: Elasticsearch URL for Secret `captainmorgue` key `elastic-url`: `https://my-elasticsearch-project-ec8b85.es.us-east4.gcp.elastic.cloud:443` (Elastic serverless project). API key from Emmanuel directly. `feat/infra` now also passes `cm-token` as `CM_TOKEN` (5fe5602); README has the full secret command.
- Sammy: image `ghcr.io/tiemma/captainmorgue` is public; use tag `sha-<7 chars of main>` from the latest image workflow run (or `latest`). Secret `captainmorgue` also takes `cm-token` (team token, env `CM_TOKEN`); add it to the deployment env. Dash0 endpoint `ingress.us-west-2.aws.dash0.com:4317`, token from Emmanuel directly.
- Jubril: live wall screen merged; check it against the new state (people objects, teams[].term, deliveries keyed by seq) and the new event types (reply, vote_request, leave).
