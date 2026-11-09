# Sammy: cluster, Radar and the story

## Now
Radar access and the public CaptainMorgue URL are confirmed; waiting for Emmanuel's reviewed `feat/infra` handoff before deployment work.

## Done
- Radar Cloud access confirmed; `https://captainmorgue.cnh.radarhq.io` is public and reachable (2026-11-09).
- Verified both repositories are clean on `main`; no `feat/infra` branch is present locally or on the cluster repo remote.
- `## Before` in `STORY.md` (cluster repo).

## Next
- Pick up Emmanuel's reviewed `feat/infra` branch: review, merge, create the hand-made Secrets through Radar, sync, confirm workloads healthy.
- Install Gitar and verify the public GHCR image once the service image is published.
- Real canary release of check-in, Radar AI investigation, post the summary to `/events`.
- `## The story` in `STORY.md` by 4:00.

## Blocked on
- Emmanuel's reviewed `feat/infra` handoff; it is not present in the current cluster clone or its remote branches.

## Handing off
