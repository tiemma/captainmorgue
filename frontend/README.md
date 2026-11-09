# CaptainMorgue screen preview

React + Vite responder workspace connected to the Go service. The default entry uses real stream state and message APIs. Storybook and ?preview=1 retain clearly labeled sample workflows.

For the live local service, plugin CLI and preview commands, see [Local development](../docs/local-development.md).

## Start

Requires Node 22.12+ and npm. From this directory:

```bash
npm ci
npm run storybook
```

Open http://127.0.0.1:6006. The sidebar contains:

- Screens / Workspace: Incident, Requests, Crew, Record, Postmortems, Join and Wall Screen.
- States / Incident: conflict, reconnecting, resolved and no active incident.
- Design system / Foundations: palette, typography and shared components.

Screen stories support local navigation and sample interactions. Reload a story to reset it. Storybook controls switch the entry view and scenario. The design preview label distinguishes fixture data from a live service.

Run `npm run dev` for the live app on5173 with an API proxy to localhost:8080. The production build is served by Go and included in Docker; /wall.html keeps the compact wall.

## Checks

```bash
npm run build
npm run build-storybook
npm test
```

Browser tests expect Chromium: install with `npx playwright install chromium`. `npm test` covers sample screen behavior; `npm run test:live` starts an isolated Go service on18195 and verifies real stream data, joins, claims, records and message writes. Build first.

## Boundaries

- `src/tokens.css`: canonical color and visual roles for this preview.
- `src/ui.tsx`: small shared component library.
- `src/screens.tsx`: screen compositions and isolated sample interactions.
- `src/*.stories.tsx`: screen, state and foundations stories.
- `.storybook/`: local review configuration; telemetry disabled.

Current decisions: ivory workspace, ink navigation, amber actions, separate operational statuses; full responder workspace; every responder may perform incident actions for the demo. Emmanuel/team supplies the real action APIs. See [the frontend plan](../docs/frontend-design-plan.md) for screen behavior and integration handoffs.

## Postmortems

`Postmortems` accepts documents, loading, error and onRetry props. It does not fetch or invent archive routes. The library and document view are ready for the backend contract; sample data lives in postmortems-fixtures.ts and Storybook. Backend list/detail endpoints and summary exposure are pending Emmanuel.
