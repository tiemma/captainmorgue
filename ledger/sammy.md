# Sammy: cluster, Radar and the story

## Now
Emmanuel's infra handoff is complete. Radar is synced and healthy; CaptainMorgue, checkin, payments, kiosk, OTEL and confdb are healthy, and the public wall is serving the live incident.

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
- `## Before` in `STORY.md` (cluster repo).

## Next
- [ ] **Milestone: set up on my agent** (AGENTS.md, "Milestone: set it up on your own agent") once the service is deployed: install the plugin, set the env, `/captainmorgue:join`, send and answer one ask. Tick and push when done.
- Complete Sammy's local agent milestone: install the plugin, configure Sammy's roster actor/team and token, join, then send and answer one ask.
- Verify the public GHCR image once the service image is published.
- Real canary release of check-in, Radar AI investigation, post the summary to `/events`.
- `## The story` in `STORY.md` by 4:00.

## Blocked on
- Sammy's roster actor/team and team token are not present in the repository or handoff; these are required only for the local-agent join milestone, not for the cluster deployment.

## Handing off
