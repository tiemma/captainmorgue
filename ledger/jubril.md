# Jubril: wall screen

## Now
14:22 - Storybook running on :6006. Revising it to use CostGraph patterns more directly and center agent-driven conversations, with human approvals and exceptions. Emmanuel/team owns action APIs.

## Done
- 14:34 - Local Storybook runs at :6006; app and static Storybook builds pass. Screen/setup commits f4d43d7 and 7a189d2 on docs/frontend-design-plan. Browser checks initially 5/6; dialog focus fix and agent-first redesign in progress.
- 14:34 - Pulled main through bfcb853; coordination, receive plugin and live-wall handoff reviewed.
- 14:34 - Codex hooks committed at 6183e68, fixture tests pass; manual context hook loaded team updates. Automatic execution still requires client hook trust.
- 14:00 - Drafted docs/frontend-design-plan.md on docs/frontend-design-plan after pulling main at 7ebf17f. Reviewed CostGraph live reference and local source with three research agents. No frontend implementation yet.

## Next
- [ ] Milestone: set up on my agent once deployed, using the instructions in AGENTS.md; not completed by this frontend preview work.
- Review Storybook against CostGraph patterns and integrate the approved design. Browser action ownership stays with Emmanuel/team; all responders may act in the demo.
- Take over the live wall screen (merged to main from feat/web-live, renders from /stream). Check state.people objects, teams[].term and deliveries keyed by seq. Fix the truncated Ticketing and Payments label and sticky last-actor highlight.
- Verify live record rendering and asynchronous record readiness against the latest service.

## Blocked on
- Full browser actions still need claim/resolve/close contracts; join, inbox, messaging and elections have now landed on main.

## Handing off
- Emmanuel: P0 coordination and live-wall handoffs received. Code review confirms seen stops timeout even without a reply; please reconcile with dispatch 5b. Browser approval is not an existing backend state; it stays a labeled sample flow in Storybook. Storybook is separate under frontend/, with local sample interactions; no collision with web/index.html. Browser action gaps and reply/readiness questions are tracked in docs/frontend-design-plan.md.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.
