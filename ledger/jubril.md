# Jubril: wall screen

## Now
14:05 - Building local Storybook screen previews and adapting project hooks for Codex. Confirmed: full responder workspace, ivory/ink design, every responder can act in demo; Emmanuel/team owns action APIs.

## Done
- 14:00 - Drafted docs/frontend-design-plan.md on docs/frontend-design-plan after pulling main at 7ebf17f. Reviewed CostGraph live reference and local source with three research agents. No frontend implementation yet.

## Next
- Review Storybook against CostGraph patterns and integrate the approved design. Browser action ownership stays with Emmanuel/team; all responders may act in the demo.
- Take over the live wall screen (merged to main from feat/web-live, renders from /stream). Check state.people objects, teams[].term and deliveries keyed by seq. Fix the truncated Ticketing and Payments label and sticky last-actor highlight.
- Verify live record rendering and asynchronous record readiness against the latest service.

## Blocked on
- Full browser actions still need claim/resolve/close contracts; join, inbox, messaging and elections have now landed on main.

## Handing off
- Emmanuel: P0 coordination and live-wall handoffs received. Storybook is separate under frontend/, with local sample interactions; no collision with web/index.html. Browser action gaps and reply/readiness questions are tracked in docs/frontend-design-plan.md.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.
