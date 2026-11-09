# Emmanuel (tiemma): service and plugin

## Now
17:30 - Demo-ready. Service live on sha-5994962 (deployed by pinning the image in the cluster repo; Radar restarts are Unauthorized), Elasticsearch persisting events, Dash0 receiving data with 5 check rules and the /alerts webhook. Plugin 0.2.9 restarted on my agent. Records, gaps and approvals branches landing next.

## Done
- [x] Milestone: set up on my agent (joined INC-1 as commander, asks exchanged with Sammy and Jubril).
- [x] Service: join, inbox, heartbeats, Raft-style elections, asks, broadcasts, claims, digest, roles, alerts and paging, incident states, close and RFO with steps taken, /records, live Dash0 signals.
- [x] Plugin: console with completion and shell capture, quiet auto-rejoins, CM_NOTIFY=off for e2e (notification spam fixed).
- [x] Merged feat/service-intel, feat/infra, fault PR #1, feat/dash0-checks; Jubril's UI branches and team graph merged; UI wired to every existing route.
- [x] Elasticsearch key verified and set; Dash0 collector token, check rules, webhook and service token set.
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
- [ ] Merge feat/records (per-incident ids, draft records), feat/gaps, feat/approvals; pin the new image in captainmorgue-cluster deploy/kustomization.yaml to deploy.
- [ ] Rehearse the full run with Sammy and Jubril; close the incident to produce the first stored RFO.

## Blocked on
- Nothing.

## Handing off
- Sammy (17:20): Elasticsearch key verified (authenticates; no cm-* indexes existed, so nothing had ever persisted) and set with the URL in Secret `captainmorgue` (`elastic-url`, `elastic-api-key`). Dash0 collector token fixed (spans for checkin and payments arriving), 5 check rules and the `/alerts` webhook applied, `dash0-auth-token` in Secret `captainmorgue`. Tick those. After the restart on the new image, check `cm-events` exists. Update the plugin to 0.2.9. Fault PR #1 still needs Gitar review.
- Sammy (16:00), to conclude the demo path, in order:
  1. **Gitar on PR #1**: https://github.com/tiemma/captainmorgue-cluster/pull/1 (fault switch for checkin) has no review and no checks; Gitar looks installed on `tiemma/captainmorgue` only. Add Gitar to `tiemma/captainmorgue-cluster` (or trigger it on the PR), let it review, then merge. Argo deploys `main`.
  2. **Verify the fault switch on the cluster** after the image builds: with kubeconfig `scripts/fault.sh on slow-checkin --ttl 300` then `status` then `off`; without kubeconfig use the Radar Job in the cluster README ("Fault switch, for the demo incident"). Check checkin latency and `fault=slow-checkin` spans show in Dash0.
  3. **Dash0**: recreate Secret `dash0` with the token above, restart `otel-collector`, confirm no `Exporting failed` lines.
  4. **Elasticsearch**: new API key with write on `cm-*` in the serverless project, update `elastic-api-key`, restart `captainmorgue`; log must say `elasticsearch=true`.
  5. **Dash0 check rule** on checkin p95 latency or 5xx rate, notification webhook `POST https://captainmorgue.cnh.radarhq.io/alerts` (endpoint lands from feat/alert shortly; `scripts/trigger.sh` is the manual fallback).
  6. **Rehearse** `docs/runbooks/` 01-06 with Emmanuel and Jubril, then 07 (alert to triage) and 08 (close and RFO) when they land. Update the plugin first (0.2.4+).
  7. **Story**: STORY.md beats: fault on -> Dash0 alert -> CaptainMorgue opens the incident and pages Platform -> claims stop two people restarting confdb -> Radar investigation -> fix -> recovered -> close -> RFO with action items.
- Everyone (15:40): plugin is now 0.2.1. Run `claude plugin marketplace update captainmorgue && claude plugin update captainmorgue@captainmorgue`, restart Claude Code, then `/captainmorgue:join` again (the service was restarted). New: roles (`CM_ROLE`), task (`/captainmorgue:task`), asks shown in chat with a picker, `/captainmorgue:console` (needs tmux), one persistent alert for asks, conflicts, escalations and joins, claims before cluster writes, catch-up digest. Runbooks: `docs/runbooks/`.
- Sammy: Dash0 token for Secret `dash0` key `token` (endpoint `ingress.us-west-2.aws.dash0.com:4317`), verified against Dash0: `auth_PwAyysWcXH4VRJVkr9MUAlsF3aIgVCR7`. Recreate the secret, restart `otel-collector`, confirm no `Exporting failed` lines.
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
