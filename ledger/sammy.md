# Sammy: cluster, Radar and the story

## Now
`feat/infra` is available at cluster commit `26bfbe8` and is under Sammy review; Radar is healthy on the current starter deployment, but required Secrets are not yet present.

## Done
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
- Review and merge `feat/infra` (`26bfbe8`), after confirming the service image is published.
- Create the hand-made `dash0` and `captainmorgue` Secrets through Radar using values supplied directly by Emmanuel; never put values in git or chat.
- Push the cluster repo, then sync and confirm workloads healthy through Radar.
- Verify the public GHCR image once the service image is published.
- Real canary release of check-in, Radar AI investigation, post the summary to `/events`.
- `## The story` in `STORY.md` by 4:00.

## Blocked on
- Dash0 token and Elastic Cloud URL/key are not present in Radar; they must be supplied directly by Emmanuel/Sammy before Secret creation.

## Handing off
