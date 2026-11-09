# Sammy: cluster, Radar and the story

## Now
Latest infra is live in Radar; CaptainMorgue, checkin, kiosk, OTEL and confdb are healthy, while payments remains Running but Not Ready due to Postgres connection refusals.

## Done
- Pulled latest private repo (`51f6bf7`) and cluster repo (`a063365`, infra merge now on public `main`).
- Added Emmanuel's Elastic API key as `elastic-api-key` on the Radar `captainmorgue` Secret.
- Verified Radar rollout: CaptainMorgue 1/1, checkin 2/2, kiosk 1/1, OTEL 1/1, and confdb Healthy.
- Diagnosed payments as `database not ready, retrying connect ECONNREFUSED` against `confdb` while its pod remains Running (0/1 Ready).
- Pulled latest repos; Emmanuel's latest `feat/infra` is `5fe5602` and adds optional `cm-token` wiring.
- Added Emmanuel's Elastic Cloud URL as `elastic-url` on the Radar `captainmorgue` Secret.
- Merged the latest infra changes locally as `5346806`.
- Created Radar Secret `captainmorgue` with key `anthropic-api-key` in `team-captainmorgue`.
- Created Radar Secret `dash0` with keys `endpoint` and `token` in `team-captainmorgue`.
- Merged `origin/feat/infra` (`26bfbe8`) locally into cluster `main` as `c457141`.
- Pulled latest private and public repos; confirmed `origin/feat/infra` exists at `26bfbe8`.
- Radar GitOps verified 1/1 Application synced and healthy; current live image remains `captainmorgue-cluster:370b934`.
- Namespace-specific Radar Checks reviewed: 4 actionable medium findings remain on the starter `app` Deployment.
- Radar namespace Secret inventory checked: no Secrets currently exist in `team-captainmorgue`.
- Gitar installed for the CaptainMorgue repository; Sammy added as an admin by Emmanuel (2026-11-09).
- Radar `team-captainmorgue` view confirms the current app Deployment has two Running pods (2026-11-09).
- Radar Cloud access confirmed; `https://captainmorgue.cnh.radarhq.io` is public and reachable (2026-11-09).
- Verified both repositories are clean on `main`; no `feat/infra` branch is present locally or on the cluster repo remote.
- `## Before` in `STORY.md` (cluster repo).

## Next
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Resolve or restart the payments workload after confirming the Postgres endpoint is accepting connections.
- Add `cm-token` to the Radar `captainmorgue` Secret when Emmanuel supplies it directly; never put values in git or chat.
- Push the cluster repo, then sync and confirm workloads healthy through Radar.
- Verify the public GHCR image once the service image is published.
- Real canary release of check-in, Radar AI investigation, post the summary to `/events`.
- `## The story` in `STORY.md` by 4:00.

## Blocked on
- Elastic API key and team `cm-token` are still missing from the Radar `captainmorgue` Secret.
- Payments is still Not Ready after the confdb Cluster became Healthy; its logs show repeated connection refusals.

## Handing off
