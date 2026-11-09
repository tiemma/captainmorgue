# Jubril: wall screen

## Now
14:05 - Building local Storybook screen previews and adapting project hooks for Codex. Confirmed: full responder workspace, ivory/ink design, every responder can act in demo; Emmanuel/team owns action APIs.

## Done
- 14:00 - Drafted docs/frontend-design-plan.md on docs/frontend-design-plan after pulling main at 7ebf17f. Reviewed CostGraph live reference and local source with three research agents. No frontend implementation yet.

## Next
- Agree browser action ownership and permission rules; then build a small shared component library and incident workspace from the design plan.
- Wire `web/index.html` to `new EventSource("/stream")`: `event` messages append log rows, `state` messages re-render tree, parts, relay, conflict, investigation and signals. Remove the playback controls.
- Record tab reads `/record/INC-1`; "happened before" card shows `past_match`.

## Blocked on
- Full browser collaboration needs session identity, messaging and claim/resolve/close contracts beyond the current observation API.

## Handing off
- Emmanuel: please confirm who owns plan section 5a; its unassigned ownership and election scope conflict with your Next and plan section 7. Browser actions and needed service fields are listed in docs/frontend-design-plan.md; this is a draft, not an agreed API change.
- Emmanuel: frontend proposal is React/Vite producing web/ static output; Docker will need a frontend build stage when implementation begins.
