# Repository hooks in Codex

The project-local `.codex/hooks.json` connects the existing team-update and
ledger-reminder scripts to Codex. The Claude Code configuration remains in
`.claude/settings.json`. This is repository coordination, not the incident
plugin's event reporting or inbox.

## Activate

1. Open this repository in a local Codex session and trust its project config.
2. Review the three hook definitions with `/hooks` in the CLI, or Settings >
   Hooks in the desktop app, and trust them. Changed definitions need review
   again. Installing this file alone does not activate untrusted hooks.
3. For ledger reminders, launch the client from an environment with
   `CM_LEDGER=jubril` (or `emmanuel` or `sammy`). Restart an existing client if
   needed so it inherits the variable. Without it, team updates still work.
4. Start a new session to exercise `SessionStart`, then send a prompt to exercise
   `UserPromptSubmit`. Check the hook UI for execution status.

No global config or persisted trust is changed by this repository. Do not use
the hook-trust bypass flag to activate it.

## Behavior

- `SessionStart` and `UserPromptSubmit` return team context using
  `hookSpecificOutput.additionalContext`. Both start a background fetch of
  `origin/main`; newly fetched changes may appear on the next invocation.
- `Stop` returns `decision: block` with a reminder after your commits outpace
  your ledger. It requests one continuation per HEAD and session. It exits when
  `stop_hook_active` is true, or the ledger already has uncommitted changes.
- Commands resolve scripts from the Git root and work from subdirectories.
  They use the event's `session_id` and the worktree's Git directory for markers;
  sibling sessions and worktrees do not consume one another's updates.
- Neither script merges, commits, pushes, or writes the ledger. They only fetch,
  read history, and write local markers and a fetch log in the Git directory.

## Limits and manual use

Verified against local `codex-cli 0.163.0`, where `hooks` is stable and enabled.
The scripts require Bash, Git, jq, shasum, and standard macOS/Linux text tools.
Read-only Git metadata or blocked network access can prevent background refresh.
Hooks are turn-driven, not a continuous notification channel. Existing sessions
must not be assumed to have loaded or trusted newly added hooks.

Cloud-orchestrated sessions do not run project-local command hooks. No
`SubagentStop` hook is registered: crew agents report back to their captain,
which owns the shared ledger.

From the repo or a subdirectory, manually inspect current remote changes with:

```bash
git fetch origin main
printf '%s\n' '{"hook_event_name":"UserPromptSubmit","session_id":"manual"}' | bash "$(git rev-parse --show-toplevel)/scripts/hooks/team-context.sh"
printf '%s\n' '{"hook_event_name":"Stop","session_id":"manual","stop_hook_active":false}' | CM_LEDGER=jubril bash "$(git rev-parse --show-toplevel)/scripts/hooks/ledger-reminder.sh"
```

Manual commands print the hook response; they do not inject it into a running
session or grant hook trust. Read changed docs and update your own ledger as
described in `AGENTS.md`.

Run `python3 scripts/hooks/test-hooks.py` to check both clients' hook commands
against temporary Git repositories, a local remote, and a sibling worktree.
The fixture never fetches or writes this repository's remote.

Protocol and activation references: [official hooks documentation](https://learn.chatgpt.com/docs/hooks),
especially configuration locations, trust review, common inputs, SessionStart,
UserPromptSubmit and Stop. The former `developers.openai.com/docs/hooks` URL
returned 404 during verification.
