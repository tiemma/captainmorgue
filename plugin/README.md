# CaptainMorgue plugin for Claude Code

Sends what you do in Claude Code to the CaptainMorgue incident timeline, and brings messages from the incident into your session.

- Every prompt you submit becomes an `action` event (first 300 characters; slash commands are skipped).
- Every Bash, Edit, Write and MCP tool call becomes an `action` event with the tool name, the command or file path, and whether it succeeded. Tool output is never sent.
- When a command names a Kubernetes object (`kubectl rollout restart deploy/checkin -n team-captainmorgue`, `kubectl get cluster confdb`, `kubectl argo rollouts abort checkin`) or a Radar MCP call carries `kind` and `name`, the event carries a `resource`, which is what CaptainMorgue uses to spot two people acting on the same thing.
- After `/captainmorgue:join`, a background poller (`bin/cm-poll`) sends a heartbeat every 5 s, holds `/inbox` open, keeps a local copy in `~/.captainmorgue/inbox.jsonl`, raises one kind of alert for asks, conflicts, escalations and joins, and answers election votes on its own. On macOS that alert is a dialog that stays until you press Open (brings your terminal forward) or Later, or for an hour (`CM_ALERT_SECONDS`); on Windows and Linux it is the system notification. `CM_NOTIFY=off` logs alerts to `~/.captainmorgue/hook.log` instead of showing them.
- Unread messages reach Claude from that local copy on session start, on every prompt and after every tool call, and are then marked seen. Session start also briefs Claude on your team and what each teammate did last. Claude does not finish a turn while an ask, conflict or escalation is unread.
- New messages also appear in the chat as a CaptainMorgue line, so you see them, not only Claude.
- An ask is shown to you verbatim and Claude asks how to answer: Reply, I am on it, Not me (route to someone), or Let my agent handle it (a subagent does the work and replies with the result). If Claude is about to stop with an ask still unanswered, it is held once to surface it, never more than once per ask. If you do not answer within 60 s, CaptainMorgue replies with your current status.

| Command | What it does |
|---|---|
| `/captainmorgue:join [team] [role] [task]` | Join the incident and start the poller. Role is `commander`, `responder` (default) or `scribe`; one commander per incident, the first to claim it. Team managers are elected, not chosen |
| `/captainmorgue:task <text>` | Tell the incident what you are working on now |
| `/captainmorgue:leave` | Leave and stop the poller |
| `/captainmorgue:status [@person or team]` | Your team, manager, term, commander, teammates and unread count; or someone's status, role, task, repo, tools and latest events |
| `/captainmorgue:inbox` | Show unread messages and mark them seen |
| `/captainmorgue:broadcast [@team or root] <message>` | Message your team (default), another team, or everyone |
| `/captainmorgue:ask @person-or-team <question>` | Direct question |
| `/captainmorgue:reply <seq> <text>` | Answer an ask |
| `/captainmorgue:console` | Open the console: your shell beside a live CaptainMorgue pane |
| `/captainmorgue:doctor` | Check the service, poller, hooks and every MCP server, with the fix for each failure |

## Console

`cm console` (or `/captainmorgue:console`) splits the terminal with tmux: your shell on the left, a live CaptainMorgue pane on the right. Inside tmux it splits the current window; otherwise it starts a tmux session `captainmorgue` running `$CM_CONSOLE_CMD` (default your shell; `CM_CONSOLE_CMD=claude` runs Claude Code there) and attaches, or tells you to `tmux attach -t captainmorgue` when started from Claude Code. Without tmux, run `plugin/bin/cm pane` in a second terminal.

The pane follows your inbox as it arrives and highlights asks you have not answered. Type:

| Input | What it does |
|---|---|
| `<seq> <text>` | Reply to that ask |
| `<seq> on` | Reply "On it" |
| `<seq> @who` | Route: ask @who the same question, then reply "Not me, asked @who" |
| `b [@team or root] <text>` | Broadcast |
| `a @who <text>` | Ask |
| `l` | Redraw |
| `q` | Quit |

The hooks never fail your turn: with `CM_URL` unset or the service down they do nothing. Failures are logged to `~/.captainmorgue/hook.log`, the poller's output to `~/.captainmorgue/poll.log`.

## Requirements

- macOS: `jq` and `curl` (`brew install jq`); the system bash 3.2 is enough. Notifications use the built-in Notification Center.
- Linux: `bash`, `jq`, `curl`. Notifications use `notify-send` (libnotify) when installed.
- Windows: Git for Windows (Claude Code runs the hooks in Git Bash) or WSL, plus `jq` on the PATH (`winget install jqlang.jq`); `curl` ships with both. Notifications use a Windows balloon via `powershell.exe`, no modules needed.

Without a notifier the poller rings the terminal bell and writes the message to `~/.captainmorgue/poll.log`.

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
export CM_TOKEN=<the team token>
export CM_ROLE=<commander|responder|scribe>
export CM_TASK=<what you are working on>
export CM_REPO=<the repo you work in>
export CM_TOOLS=<tools you have connected, comma separated>
```

With `CM_URL` unset the plugin does nothing. `CM_TEAM` is optional; the service looks it up from the roster. `CM_TOKEN` is sent as `Authorization: Bearer` on every call. `CM_INCIDENT` defaults to `INC-1`. `CM_ROLE`, `CM_TASK`, `CM_REPO` and `CM_TOOLS` are sent at join and shown to everyone; arguments to `/captainmorgue:join` override role and task.

Then set up the MCP servers below, run `/captainmorgue:doctor`, and run `/captainmorgue:join` once in Claude Code. Outside Claude Code the same commands are `plugin/bin/cm join`, `plugin/bin/cm status`, `plugin/bin/cm doctor` and so on, with arguments on stdin.

## MCP servers

The plugin brings the MCP servers every responder uses, so your agent acts on them with your own identity:

| Server | Endpoint | Sign-in |
|---|---|---|
| `dash0` | `https://api.us-west-2.aws.dash0.com/mcp` | `export DASH0_AUTH_TOKEN=<token>`: a Dash0 auth token with read access (`*:read` or `*`); an ingest-only token is rejected. Create one under Settings, Auth Tokens in Dash0. |
| `radar` | `https://api.radarhq.io/mcp` | OAuth: run `/mcp`, pick `radar` and sign in to Radar Cloud in the browser. |

Set `DASH0_AUTH_TOKEN` in the same shell profile as `CM_URL` and restart Claude Code. If you already added either server yourself with the same URL (for example `radar-cloud`), Claude Code keeps yours and skips the plugin's copy. To sign in to Dash0 with OAuth instead of a token, add it yourself: `claude mcp add --transport http --scope user dash0 https://api.us-west-2.aws.dash0.com/mcp`, then `/mcp`.

`/captainmorgue:doctor` checks `jq`, `curl` and `claude`, that `CM_URL` answers, that the poller runs, that the plugin's hooks are installed, and that each MCP server in `claude mcp list` is connected, and prints `ok` or `FAIL` with the fix for each. It never prints a token or a server's command line. The last line lists the connected MCP servers; doctor saves them to `~/.captainmorgue/tools`, and `/captainmorgue:join` sends them as your tools (shown next to your name in CaptainMorgue) unless `CM_TOOLS` is set. Run doctor before join, so the poller line fails the first time.

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
