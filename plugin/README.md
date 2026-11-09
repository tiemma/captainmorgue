# CaptainMorgue plugin for Claude Code

Sends what you do in Claude Code to the CaptainMorgue incident timeline, and adds `/captainmorgue:broadcast`.

- Every prompt you submit becomes an `action` event (first 300 characters; slash commands are skipped).
- Every Bash, Edit, Write and MCP tool call becomes an `action` event with the tool name, the command or file path, and whether it succeeded. Tool output is never sent.
- When a command names a Kubernetes object (`kubectl rollout restart deploy/checkin -n team-captainmorgue`, `kubectl get cluster confdb`, `kubectl argo rollouts abort checkin`) or a Radar MCP call carries `kind` and `name`, the event carries a `resource`, which is what CaptainMorgue uses to spot two people acting on the same thing.
- `/captainmorgue:broadcast <message>` posts to `/broadcast`; CaptainMorgue relays it to the people who need it.

The hooks run in the background with a 2 second timeout and never fail your turn. Failures are logged to `~/.captainmorgue/hook.log`. Needs `bash`, `jq` and `curl`.

## Install

In Claude Code:

```
/plugin marketplace add tiemma/captainmorgue
/plugin install captainmorgue@captainmorgue
```

From a local checkout, use the path instead: `/plugin marketplace add ./captainmorgue`. The shell equivalents are `claude plugin marketplace add ...` and `claude plugin install captainmorgue@captainmorgue`.

## Configure

Set these in the shell you start Claude Code from:

```
export CM_URL=https://captainmorgue.cnh.radarhq.io
export CM_ACTOR=<your GitHub login, as in roster.yaml>
export CM_TEAM=<your team id from roster.yaml>
```

With `CM_URL` unset the plugin does nothing. `CM_TEAM` is optional; the service looks it up from the roster.

## Test without an incident

Start the service and replay the demo incident into it:

```
cd service && ROSTER=../roster.yaml WEB_DIR=../web PORT=8080 go run .
CM_URL=http://localhost:8080 DELAY=1 scripts/replay.sh
```

The replay includes Gus's broadcast and the conflict between Dana's canary abort and Dev's restart. Watch it with `curl -N $CM_URL/stream` or read `curl $CM_URL/record/INC-1`.

To try the hook by hand:

```
echo '{"hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"kubectl -n team-captainmorgue rollout restart deploy/checkin"}}' | plugin/hooks/send.sh
```
