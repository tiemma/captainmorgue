# CaptainMorgue screen preview

Local React + Vite + Storybook review surface for the frontend redesign. The screens use sample incident data and local state. They do not call the service or change a real incident.

## Start

Requires Node 22.12+ and npm. From this directory:

```bash
npm ci
npm run storybook
```

Open http://127.0.0.1:6006. The sidebar contains:

- Screens / Workspace: Incident, Messages, Crew, Record, Join and Wall Screen.
- States / Incident: conflict, reconnecting, resolved and no active incident.
- Design system / Foundations: palette, typography and shared components.

Screen stories support local navigation and sample interactions. Reload a story to reset it. Storybook controls switch the entry view and scenario. The design preview label distinguishes fixture data from a live service.

The standalone preview is available with `npm run dev`. It uses the same screen components. The existing Go-served `web/index.html` remains the live-integration starting point until the design and action APIs are agreed.

## Checks

```bash
npm run build
npm run build-storybook
npm test
```

Browser tests expect a Chromium installation supported by Playwright; install it with `npx playwright install chromium` when necessary. They exercise local screens, not backend delivery or permissions.

## Boundaries

- `src/tokens.css`: canonical color and visual roles for this preview.
- `src/ui.tsx`: small shared component library.
- `src/screens.tsx`: screen compositions and isolated sample interactions.
- `src/*.stories.tsx`: screen, state and foundations stories.
- `.storybook/`: local review configuration; telemetry disabled.

Current decisions: ivory workspace, ink navigation, amber actions, separate operational statuses; full responder workspace; every responder may perform incident actions for the demo. Emmanuel/team supplies the real action APIs. See [the frontend plan](../docs/frontend-design-plan.md) for screen behavior and integration handoffs.
