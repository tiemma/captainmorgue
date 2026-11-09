#!/usr/bin/env bash
set -u

command -v jq >/dev/null || exit 0
input=$(cat)
event=$(jq -r '.hook_event_name // "UserPromptSubmit"' <<<"$input" 2>/dev/null) || event=UserPromptSubmit
case "$event" in SessionStart|UserPromptSubmit) ;; *) exit 0 ;; esac
session=$(jq -r '.session_id // "manual"' <<<"$input" 2>/dev/null) || exit 0
session_key=$(printf '%s' "$session" | shasum -a 256 | cut -d ' ' -f 1)

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --absolute-git-dir) || exit 0
log="$gitdir/cm-hooks.log"
seen_file="$gitdir/cm-last-seen-main-$session_key"

(GIT_TERMINAL_PROMPT=0 git fetch -q origin main </dev/null >>"$log" 2>&1 &)

head=$(git rev-parse -q --verify origin/main) || exit 0
prev=$(cat "$seen_file" 2>/dev/null || true)
[ "$head" = "$prev" ] && exit 0
echo "$head" >"$seen_file"

if [ -n "$prev" ] && git merge-base --is-ancestor "$prev" "$head" 2>/dev/null; then
  range=("$prev..$head")
  base="$prev"
else
  range=(-8 "$head")
  base=$(git rev-list --max-count=9 "$head" | tail -1)
fi

commits=$(git log --format='- %h %an: %s' "${range[@]}" | head -30)
changed=$(git diff --stat=100 "$base" "$head" -- AGENTS.md docs ledger roster.yaml 2>/dev/null | tail -20)
ledger=$(git diff -U0 "$base" "$head" -- ledger 2>/dev/null | grep -E '^(\+\+\+|\+[^+])' | sed 's#^+++ b/#== #' | head -80)
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")

context="CaptainMorgue team update: origin/main has new commits (this checkout is $behind behind; run git pull before editing shared files).

New commits:
$commits

Shared docs and ledgers changed:
$changed

Ledger additions:
$ledger

Read the changed docs before acting on anything they cover. Update your own ledger/<name>.md when your work changes."

jq -n --arg e "$event" --arg c "$context" '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}}'
