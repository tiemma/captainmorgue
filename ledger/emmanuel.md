# Emmanuel (tiemma): service and plugin

## Now
Joined the live incident as tiemma (platform, manager). Four crew agents on feat/roles, feat/claim, feat/digest, feat/notify. Demo data removed from main (`3fcebda`).

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
- Sammy (15:00), in order:
  1. Elasticsearch: the service gets 401 on `cm-events`. Create an API key in the serverless project with write on `cm-*`, update `elastic-api-key` in Secret `captainmorgue`, restart. Done when the log says `elasticsearch=true`.
  2. Dash0: the collector token is rejected ("blocked"); Emmanuel sends you the verified token directly (not via git). Recreate Secret `dash0` (endpoint `ingress.us-west-2.aws.dash0.com:4317`), restart `otel-collector`. Done when no `Exporting failed` lines and checkin traces show in Dash0.
  3. Remove `payments` and the ticketing team from the cluster; roster now has only registration (checkin, kiosk) and platform (confdb, otel-collector, captainmorgue).
  4. After the image for `3fcebda` builds, `kubectl -n team-captainmorgue rollout restart deploy/captainmorgue` to load the new roster and drop test people.
  5. Gitar: install on `tiemma/captainmorgue-cluster`, ship the checkin canary as a PR so Gitar reviews it.
  6. Dash0 check rule on checkin error rate, notification webhook to `POST https://captainmorgue.cnh.radarhq.io/events`.
- No team token any more: the service runs open for the hackathon.
- Sammy: the team token is not needed on the cluster; leave `cm-token` out of the secret.
- Sammy (14:30): Emmanuel is granting you write access to `tiemma/captainmorgue-cluster`; accept the invite, then push your merge `c457141`. Your agent then runs the deploy steps: Argo sync through Radar, confirm `captainmorgue`, `checkin`, `payments`, `kiosk`, `confdb`, `otel-collector` healthy, open `https://captainmorgue.cnh.radarhq.io` (wall screen, not the starter app). Then post in your ledger "deployed" so everyone does the set-up-your-agent milestone.
- Sammy: Elasticsearch URL for Secret `captainmorgue` key `elastic-url`: `https://my-elasticsearch-project-ec8b85.es.us-east4.gcp.elastic.cloud:443` (Elastic serverless project). API key from Emmanuel directly. `feat/infra` now also passes `cm-token` as `CM_TOKEN` (5fe5602); README has the full secret command.
- Sammy: image `ghcr.io/tiemma/captainmorgue` is public; use tag `sha-<7 chars of main>` from the latest image workflow run (or `latest`). Secret `captainmorgue` also takes `cm-token` (team token, env `CM_TOKEN`); add it to the deployment env. Dash0 endpoint `ingress.us-west-2.aws.dash0.com:4317`, token from Emmanuel directly.
- Jubril: live wall screen merged; check it against the new state (people objects, teams[].term, deliveries keyed by seq) and the new event types (reply, vote_request, leave).
