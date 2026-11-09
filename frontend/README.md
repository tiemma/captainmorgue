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
- Screens / Team graph: the team tree with relationship arcs, plus loading and unavailable states.
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

Current decisions: monochrome neutrals, one blue accent for focus, selection and links, status as a dot or glyph plus text, Funnel Display / Geist / Geist Mono typography, and light and dark themes. Emmanuel/team supplies the real action APIs. See [the frontend plan](../docs/frontend-design-plan.md) for screen behavior and integration handoffs.

## Team graph

The live Teams tab reads `GET /api/graph` (optional `start` and `end`, RFC 3339). The service builds it at read time from the roster and the incident events: the team tree (`part_of`, `member_of`, `manages`, `owns`) plus team-to-team arcs for `depends_on` (a team acted on a resource another team owns, inferred), `messaged` (asks, replies, relays and pages across teams) and `shared_incident` (teams pulled in together). The view is a pan and zoom canvas (`@xyflow/react`, laid out by `elkjs`, which loads as its own chunk) with draggable nodes, zoom controls and a minimap. Arcs stay hidden until a team is hovered or selected; the selected team is kept in `?focus=`. `calls` and `uses` arrive when Dash0 traces and Radar topology feed the service. Fonts are bundled from `@fontsource`, so the app works offline.

## Event colours

Events are colour coded by kind everywhere they are listed (activity feed, record timeline, postmortems), with a legend: alerts and signals red, conflicts pink, investigation violet, decisions amber, commands and claims teal, messages blue, resolution green, crew and system grey. The mapping lives in `src/event-categories.tsx`; the colours are tokens in `src/tokens.css`.

## Recordings

The plugin sends every agent tool call and every console shell command with `tool`, `command` and `outcome` (plus `exit_code`, `duration_ms` and `cwd` from the console). Commands that look like they carry a secret are redacted. The service turns the event log into `steps` and `commands` on `GET /record/{id}`, `GET /postmortems` and `GET /postmortems/{id}`: each command is marked `changed` (not a read) and `led_to_resolution` (a successful change before the incident closed or recovered). Older plugins that only send `Bash: <command> (ok)` text are parsed the same way. The Record tab and each postmortem show these on a timeline: hover or focus a marker to see what ran, by whom and with what result. A postmortem also lists the commands that resolved the incident and can copy them as a runbook.

## Postmortems

`Postmortems` accepts documents, loading, error and onRetry props. The live Postmortems tab loads them from `GET /postmortems`, which today serves the current incident from memory; listing past incidents from Elasticsearch is still to do. Sample data lives in postmortems-fixtures.ts and Storybook.
