# Working on CaptainMorgue

Three people, each running Claude Code, building one product before the 5:30 demo. Read this, then [docs/hackathon-plan.md](docs/hackathon-plan.md) (the contract and who owns what), [docs/dispatch.md](docs/dispatch.md) (messaging, elections, liveness; draft), then the `ledger/` file of anyone whose work you depend on.

## Ledger: one file per person

`ledger/<name>.md` is that person's progress. Read the others' files before you start a piece of work; update your own whenever something changes.

- Update it when you start a task, finish one, get blocked, or hand something off. Commit and push it on its own (`docs(ledger): ...`) so others see it straight away.
- Sections, in this order: **Now** (one line), **Done** (newest first, with the commit or branch), **Next**, **Blocked on**, **Handing off**.
- Only edit your own file. To ask someone for something, add it under **Handing off** in your file with their name; they move it into their **Next** when they pick it up.
- Times are local, `HH:MM`. Plain ASCII.

## Captain and crew

Every session works the way Capy's captains do: one captain session plans and delegates, crew agents do the work in isolation, the captain reviews before anything lands.

- **Your Claude Code session is the captain for your area.** It reads the ledger and the plan, splits the next piece of work into tasks that do not touch the same files, and hands each to a subagent.
- **Each crew agent gets its own git worktree and branch** (`feat/<area>-<task>`). It builds, runs the real thing, does a simplify and correctness pass over its own diff, commits, and reports back. It does not push.
- **The captain reviews the diff, then merges and pushes.** It updates the ledger with what landed.
- Brief crew agents with the goal, the files to read, the contract section that applies, and what "done" means. Do not hand them credentials; run anything that needs a secret yourself.
- CaptainMorgue does the same thing for an incident: it is the captain, each responder's agent is crew, every part of the incident has one owner, and the record is the review.

## Staying in sync: hooks in `.claude/settings.json`

This repo ships project hooks. Claude Code asks you to trust them the first time you open the repo; say yes.

- **`scripts/hooks/team-context.sh`** runs on session start and on every prompt. It fetches `origin/main` in the background and, when there are commits you have not seen, hands Claude the new commit list, which docs and ledgers changed, and what others added to their ledgers. Your session always knows what the others just pushed. It never blocks: the fetch is backgrounded, so news shows up on the prompt after it lands.
- **`scripts/hooks/ledger-reminder.sh`** runs when Claude finishes a turn. If you have committed since your `ledger/<name>.md` last changed, Claude is asked once to update and push it. Set `CM_LEDGER` to your ledger name (`emmanuel`, `jubril`, `sammy`) in your shell to turn it on.

Docs live in the repo. Anything written about the design (plans, specs, diagrams) goes into `docs/` and is pushed as it is written, so the hook carries it to everyone. `docs/dispatch.md` is the current draft for messaging, elections and liveness.

## Branches and merging

- `main` always builds and runs. Work on a branch, merge to `main` when it runs locally, push.
- Pull `main` before you start a task. If two people need the same file, say so in your ledger first.
- Commits use Conventional Commits: `feat(service): ...`, `fix(web): ...`, `docs(ledger): ...`.

## Running it locally

```bash
docker compose up -d elasticsearch          # optional; add --profile kibana for Kibana on :5601
cd service && ROSTER=../roster.yaml WEB_DIR=../web go run .
CM_URL=http://localhost:8080 scripts/replay.sh   # plays the demo incident into it
open http://localhost:8080
```

Environment: `PORT` (8080), `ROSTER`, `WEB_DIR`, `ELASTIC_URL` (`http://localhost:9200` with compose), `ELASTIC_API_KEY`, `ANTHROPIC_API_KEY`. Everything works without the last three.

Install the agent plugin: see [plugin/README.md](plugin/README.md). Set `CM_URL`, `CM_ACTOR` (your GitHub login) and `CM_TEAM`.

## Rules

- Never commit a credential, kubeconfig or token. The cluster repo is public; Secrets are created by hand through Radar.
- The service computes every number; the web page only renders what `/stream` and `/record` return.
- Do not change the contract in the plan without telling the others in your ledger first.
- No code comments; plain ASCII in code, commits and docs.
- On the cluster, follow `AGENTS.md` in `tiemma/captainmorgue-cluster`: deploy by pushing to `main`, never break things on purpose.
