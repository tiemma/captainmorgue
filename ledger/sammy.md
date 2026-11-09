# Sammy: cluster, Radar and the story

## Now
Emmanuel's infra handoff is complete. Sammy is online in the fresh INC-1 incident with Jubril (`s1ntaxe770r`); the fault/telemetry rehearsal is in progress, while the fault PR and Dash0 rule application remain permission-gated.

## Done
- Pulled latest private repo (`1dfb941`) and cluster repo (`e3ea5b2`) on public `main`.
- Added Emmanuel's Elastic API key as `elastic-api-key` on the Radar `captainmorgue` Secret.
- Verified Radar rollout: CaptainMorgue 1/1, checkin 2/2, kiosk 1/1, OTEL 1/1, and confdb Healthy.
- Verified the payments recovery in Radar: deployment is Healthy `1/1`; logs now report `schema ready for payments`.
- Pulled latest repos; Emmanuel's latest `feat/infra` is `5fe5602` and adds optional `cm-token` wiring.
- Added Emmanuel's Elastic Cloud URL as `elastic-url` on the Radar `captainmorgue` Secret.
- Merged the latest infra changes locally as `5346806`.
- Created Radar Secret `captainmorgue` with key `anthropic-api-key` in `team-captainmorgue`.
- Created Radar Secret `dash0` with keys `endpoint` and `token` in `team-captainmorgue`.
- Merged `origin/feat/infra` (`26bfbe8`) locally into cluster `main` as `c457141`.
- Pulled latest private and public repos; confirmed `origin/feat/infra` exists at `26bfbe8`.
- Radar GitOps verified 1/1 Application `Synced/Healthy`; live cluster image is `captainmorgue-cluster:a063365`.
- Namespace-specific Radar Checks reviewed: 4 actionable medium findings remain on the starter `app` Deployment.
- Radar namespace Secret inventory checked: no Secrets currently exist in `team-captainmorgue`.
- Gitar installed for the CaptainMorgue repository; Sammy added as an admin by Emmanuel (2026-11-09).
- Radar `team-captainmorgue` view confirms the current app Deployment has two Running pods (2026-11-09).
- Radar Cloud access confirmed; `https://captainmorgue.cnh.radarhq.io` is public and reachable (2026-11-09).
- Verified both repositories are clean on `main`; no `feat/infra` branch is present locally or on the cluster repo remote.
- Public `https://captainmorgue.cnh.radarhq.io` verified reachable and serving the CaptainMorgue wall.
- Emmanuel's final handoff says the team token is not needed on the cluster; `cm-token` is intentionally omitted from Radar.
- Configured Sammy's local non-secret agent environment (`CM_URL`, actor `sammy`, team `platform`, ledger `sammy`) and joined `INC-1` through Codex; the service accepted Sammy as the Platform agent (term 5).
- Claude Code and the plugin prerequisites are not installed on this Windows machine, so the local poller/heartbeat and ask/reply step remain pending.
- Communication test passed: Sammy sent Emmanuel (`tiemma`) a direct ask on `INC-1`; CaptainMorgue delivered it as inbox sequence `30`.
- End-to-end receive test passed: Emmanuel replied through CaptainMorgue as sequence `31`; Sammy's inbox received it and acknowledged it, with heartbeat returning `204`.
- Registered the local `CaptainMorgue-Sammy-Agent` Windows logon task for background heartbeats, inbox polling, local inbox storage and Windows notifications; Radar now sees Sammy online continuously.
- Repaired the local agent state path to `C:\Users\samlo\.captainmorgue-codex`; verified the task joined `INC-1`, received the catch-up inbox message, and Radar reported Sammy `online` with a fresh heartbeat (2026-11-09).
- OBS Studio is available locally and was configured with a full-display capture source; no finalized recording file was produced because the Windows computer-control session stopped before the rehearsal capture could be completed.
- Added the check-in attendee lookup and Argo Rollouts canary configuration in public cluster commit `fefc494`; fixed the Rollout ConfigMap reference in `aba247b`, with Radar confirming 17/17 resources healthy.
- Started a Radar AI investigation for `confdb-ro`, posted the investigation, signal and ship evidence to `/events`, and verified the public wall renders the rehearsal timeline.
- Completed `STORY.md` with the before/after Checks, deployment timeline, investigation evidence and Radar screenshot links in public commit `5b5fbd2`.
- Ran the bounded live rehearsal: public `/healthz` returned 200, the incident record contained five events, and the wall displayed the investigation, signal and ship summary.
- `## Before` in `STORY.md` (cluster repo).
- Pulled private main through `4360ae3` and public main through `d20686e`; discovered public branches `feat/fault-injection` (`357a682`) and `feat/dash0-checks` (`0ff68da`) with the next rehearsal work.
- Handed item 1 back to Emmanuel: Sammy lacks permission to trigger/add Gitar on the public cluster repo or merge PR #1.
- Rejoined fresh INC-1 as Sammy, restored the local poller after its stale cursor skipped the reset sequence, and verified Sammy plus Jubril (`s1ntaxe770r`) online.
- Completed the safe coordination portion of runbooks 01-06: Sammy joined, set the rehearsal task, broadcast to Platform, and recorded the non-destructive conflict action; asked Jubril to run the teammate-side steps.
- Verified the current incident record persists the new rehearsal events; this confirms the live record path but does not prove Elasticsearch logs `elasticsearch=true`.
- Public story update pushed in `captainmorgue-cluster` commit `8b85902`.

## Next
- [ ] Emmanuel: review/merge public cluster PR #1 (`feat/fault-injection`) and grant/trigger Gitar on `tiemma/captainmorgue-cluster`; Sammy does not have the required repository permissions.
- [ ] Apply the five Dash0 rules and webhook from public branch `feat/dash0-checks` after a Dash0 rules/channel API token is supplied; the existing Radar `dash0` Secret is only the collector credential.
- [ ] Verify the deployed fault switch and Dash0 traces after PR #1 lands; current live check-in pods are still on the pre-fault-switch image.
- [ ] Ask Emmanuel to verify CaptainMorgue logs for `elasticsearch=true`; the public health/record test passed but Sammy lacks Radar log permissions.
- [ ] Finish the remaining multi-person runbook steps with Jubril and Emmanuel.
- [ ] Grant the public cluster repository's GitHub Actions identity package-write access, rerun the failed `fefc494` image build, then verify the attendee-lookup image and promote the check-in canary.
- [ ] Capture the final rehearsal screen recording.
- [ ] Optional cleanup: review the remaining Radar Check findings and remove the unused legacy `my-secret` only with explicit approval.

## Blocked on
- GHCR build for `fefc494` failed with `permission_denied: write_package`; the live Rollout remains healthy on image `a063365`.
- Fault verification is blocked until Emmanuel merges PR #1 and the new image is deployed; Dash0 rule application is blocked without a Dash0 rules/channel API token.
- Elasticsearch log confirmation and Gitar/PR actions require Emmanuel's repository/Radar permissions.
- Screen recording remains pending after the computer-control session stopped while switching to the public wall; the live rehearsal verification itself passed and the agent is online.

## Handing off
- Emmanuel: item 1 is handed back because Sammy lacks permission to add/trigger Gitar or merge public cluster PR #1. Please merge/enable it, then notify Sammy so the fault rehearsal can be verified.
