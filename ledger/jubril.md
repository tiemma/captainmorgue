# Jubril: wall screen

## Now
14:54 - Agent-first Storybook is ready for review on :6006: concise navigation, progressive disclosure, CostGraph typography, resizable inline inspector and active response timeline. Local sample interactions; live API integration remains next.

## Start here (from Emmanuel, 14:35)
The wall screen is already live-wired on `main` (`web/index.html`); you own it from here. Run it locally:

```bash
git pull
cd service && ROSTER=../roster.yaml WEB_DIR=../web go run .      # terminal 1, http://localhost:8080
CM_URL=http://localhost:8080 DELAY=0.5 bash scripts/replay.sh       # terminal 2, plays the demo incident
open http://localhost:8080
```

Before every merge: `scripts/e2e.sh` must print ALL PASSED. Then do the set-up-your-agent milestone below as soon as Sammy's ledger says deployed.

## Done
- 14:54 - Typography (309cf23), inline panel (f61b6cb) and chronological timeline (e49a35e) integrated. Final app and static Storybook builds pass; all 14 browser tests pass, including inspector pointer/keyboard persistence, progressive disclosure, active/closed timeline and reduced motion. Desktop/mobile screenshots inspected; no overflow.
- 14:49 - Main merged through 1eb6d6e (65009a7); preserved Emmanuel's plugin auto-install handoff. No backend or deployment changes.
- 14:49 - 2991fc0 and cbb286d add CostGraph app patterns, progress states and agent approval workflows. 8ceb978 adds Requests/Record labels, closed Evidence/History/Details disclosures, and lifecycle stories. b4bcba5 adds 11 passing browser tests.
- 14:49 - Local service/plugin E2E passed all 8 checks on bfcb853; no live incident was mutated. Latest main changes the E2E token check and docs only.
- 14:34 - Local Storybook runs at :6006; app and static Storybook builds pass. Screen/setup commits f4d43d7 and 7a189d2 on docs/frontend-design-plan. Browser checks initially 5/6; dialog focus fix and agent-first redesign in progress.
- 14:34 - Pulled main through bfcb853; coordination, receive plugin and live-wall handoff reviewed.
- 14:34 - Codex hooks committed at 6183e68, fixture tests pass; manual context hook loaded team updates. Automatic execution still requires client hook trust.
- 14:00 - Drafted docs/frontend-design-plan.md on docs/frontend-design-plan after pulling main at 7ebf17f. Reviewed CostGraph live reference and local source with three research agents. No frontend implementation yet.

## Next
- [ ] **Install the plugin automatically** (from Emmanuel, 14:40). Today each person runs `/plugin marketplace add` and `/plugin install` by hand. Make it automatic: in `.claude/settings.json` of this repo and of `tiemma/captainmorgue-cluster`, add `extraKnownMarketplaces` (`captainmorgue` -> GitHub `tiemma/captainmorgue`) and `enabledPlugins` (`"captainmorgue@captainmorgue": true`), so anyone who opens either repo in Claude Code and trusts it is offered the plugin. Check the exact keys in the Claude Code settings docs, test it in a fresh clone, and update the milestone steps in AGENTS.md.
- [ ] Milestone: set up on my agent once deployed, using the instructions in AGENTS.md; not completed by this frontend preview work.
- Review the updated Storybook and wire the agreed screens to the live service. Browser action ownership stays with Emmanuel/team; all responders may act in the demo.
- Take over the live wall screen (merged to main from feat/web-live, renders from /stream). Check state.people objects, teams[].term and deliveries keyed by seq. Fix the truncated Ticketing and Payments label and sticky last-actor highlight.
- Verify live record rendering and asynchronous record readiness against the latest service.

## Blocked on
- Full browser actions still need claim/resolve/close contracts; join, inbox, messaging and elections have now landed on main.

## Handing off
- Emmanuel: P0 coordination and live-wall handoffs received. Code review confirms seen stops timeout even without a reply; please reconcile with dispatch 5b. Browser approval is not an existing backend state; it stays a labeled sample flow in Storybook. Storybook is separate under frontend/, with local sample interactions; no collision with web/index.html. Browser action gaps and reply/readiness questions are tracked in docs/frontend-design-plan.md.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.
