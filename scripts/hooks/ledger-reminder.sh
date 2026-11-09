#!/usr/bin/env bash
set -u

command -v jq >/dev/null || exit 0
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" = "true" ] && exit 0
[ -n "${CM_LEDGER:-}" ] || exit 0
case "$CM_LEDGER" in emmanuel|jubril|sammy) ;; *) exit 0 ;; esac
session=$(jq -r '.session_id // "manual"' <<<"$input" 2>/dev/null) || exit 0
session_key=$(printf '%s' "$session" | shasum -a 256 | cut -d ' ' -f 1)

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --absolute-git-dir) || exit 0
file="ledger/$CM_LEDGER.md"
[ -f "$file" ] || exit 0
git diff --quiet HEAD -- "$file" 2>/dev/null || exit 0

last_ledger=$(git log -1 --format=%H -- "$file")
[ -n "$last_ledger" ] || exit 0
author=$(git config user.email) || exit 0
mine=$(git log --format=%ae "$last_ledger..HEAD" | awk -v author="$author" '$0 == author { n++ } END { print n+0 }')
[ "$mine" -gt 0 ] || exit 0

marker="$gitdir/cm-ledger-reminded-$session_key"
head=$(git rev-parse HEAD)
[ "$(cat "$marker" 2>/dev/null)" = "$head" ] && exit 0
echo "$head" >"$marker"

jq -n --arg r "You made $mine commit(s) since $file was last updated. Update its Now, Done, Next, Blocked on and Handing off sections, then commit and push it on its own (docs(ledger): ...)." '{decision: "block", reason: $r}'
