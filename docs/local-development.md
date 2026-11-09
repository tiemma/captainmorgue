# Local development

Run these commands from the repository root. Requirements: Go (version in service/go.mod), Node 22.12+ and npm, jq and curl. No cloud account is needed for the basic local app.

## Live local app

In terminal 1:

```bash
cd service
env -u ELASTIC_URL -u ELASTIC_API_KEY -u ANTHROPIC_API_KEY -u CM_TOKEN \
  PORT=8080 ROSTER=../roster.yaml WEB_DIR=../web go run .
```

Open http://127.0.0.1:8080. This is the real Go service and its live wall, consuming /stream. It starts empty. This command intentionally runs without cloud integrations; data is held in memory. Stop it with Ctrl-C. The first run downloads Go dependencies.

In terminal 2, add a local responder and an activity event:

```bash
curl -fsS http://127.0.0.1:8080/incidents/INC-1/join \
  -H 'Content-Type: application/json' \
  -d '{"actor":"local-responder","team":"registration","role":"scribe","task":"Inspect local check-in"}'
curl -fsS http://127.0.0.1:8080/events \
  -H 'Content-Type: application/json' \
  -d '{"actor":"local-responder","team":"registration","type":"action","text":"Reviewing local check-in recovery"}'
```

The responder becomes offline without heartbeats; that is expected for this small smoke check. Full agent/plugin setup is described in plugin/README.md. Plugin sessions use ~/.captainmorgue, so running a local plugin join can replace an existing live session; keep live rehearsal setup separate.

## Redesigned frontend

In another terminal:

```bash
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173. This is the React design preview. It includes sample responder workflows and Postmortems; its buttons do not mutate the Go service. The archive API is pending, so the Postmortems collection is explicitly sample data. See frontend/src/postmortems.tsx for the data-driven component boundary.

## Storybook

```bash
cd frontend
npm run storybook
```

Open http://127.0.0.1:6006. Screens / Workspace includes the full navigation; Screens / Postmortems covers library, empty, loading and error states. Ctrl-C stops either frontend process.

## Checks

```bash
npm --prefix frontend run build
npm --prefix frontend run build-storybook
cd frontend
npx playwright install chromium
npm test
```

From the repository root, run the real service/plugin checks with `env -u CM_URL -u CM_TOKEN bash scripts/e2e.sh`. They must print ALL PASSED before merging to main. Never point this command at the live rehearsal unintentionally.

Cloud-backed persistence and generated summaries require ELASTIC_URL, ELASTIC_API_KEY and ANTHROPIC_API_KEY. Configure them privately only when testing those integrations; do not commit values. The offline command above unsets them deliberately.
