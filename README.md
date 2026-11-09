# CaptainMorgue

Where incidents go to die.

Each responder gets an agent on their laptop, and CaptainMorgue coordinates all of them across one incident. It records who did what and how far it moved the incident, routes messages to the people who need them, flags conflicting actions, and writes the incident record from the timeline when it closes. Built for a hackathon on Elasticsearch, Dash0, A2A, Radar and Gitar.

## Start here

- [Local development](docs/local-development.md): start the live local app, React preview and Storybook.

- [docs/overview.md](docs/overview.md): one-page overview of the whole design, open questions, and status. Start here.
- [AGENTS.md](AGENTS.md): how we work together, the per-person ledger in `ledger/`, and how to run it locally.
- [docs/hackathon-plan.md](docs/hackathon-plan.md): today's build. The contract, who does what, and the checkpoints. Read this first.
- [docs/prd.md](docs/prd.md): what CaptainMorgue does, decisions so far, hackathon scope, and open questions (section 6).
- [docs/architecture.md](docs/architecture.md): how it is built, covering components, messaging, the record and manager elections.
- [docs/captainmorgue-map.html](docs/captainmorgue-map.html): topology diagram and UI patterns. Open it in a browser.
- [docs/demo.html](docs/demo.html): playable wall-screen demo of the web app on the example conference incident.
- [design/](design/): design system. `tokens.css` for the web app, `index.html` as the live component reference.

Pick an open question from PRD section 6, or a piece from the hackathon scope in PRD section 4.

## Dash0

Dash0 watches the conference services and pushes alerts to `POST /alerts`; CaptainMorgue also reads live signals back from Dash0 while an incident is open (see [Signals](docs/contract.md#signals)). The check rules and the webhook channel live in the cluster repo, `tiemma/captainmorgue-cluster`, under `dash0/`.

Someone with Dash0 admin access (Sammy or Emmanuel) does this once:

1. In Dash0, **Settings** > **Auth Tokens** > **Create**: read and write on check rules and notification channels, plus query on dataset `default`.
2. From the cluster repo: `read -rs DASH0_AUTH_TOKEN; export DASH0_AUTH_TOKEN`, then `scripts/dash0-apply.sh --dry-run` to see the requests, then `scripts/dash0-apply.sh`.
3. Add the token to the service: key `dash0-auth-token` in Secret `captainmorgue` in `team-captainmorgue` (the cluster README has the `kubectl patch`), then restart `deployment/captainmorgue`. `dash0-api-url` is optional; it defaults to `https://api.us-west-2.aws.dash0.com`.

Locally: `DASH0_AUTH_TOKEN=... go run .` in `service/`. Without the token the service logs `dash0 signals off` and runs as before.
