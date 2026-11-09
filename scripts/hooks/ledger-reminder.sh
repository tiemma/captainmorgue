#!/usr/bin/env bash
set -u

command -v jq >/dev/null || exit 0
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" = "true" ] && exit 0
[ -n "${CM_LEDGER:-}" ] || exit 0

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --git-common-dir)
file="ledger/$CM_LEDGER.md"
[ -f "$file" ] || exit 0
git diff --quiet HEAD -- "$file" 2>/dev/null || exit 0

last_ledger=$(git log -1 --format=%H -- "$file")
[ -n "$last_ledger" ] || exit 0
mine=$(git rev-list --count --author="$(git config user.email)" "$last_ledger..HEAD" 2>/dev/null || echo 0)
[ "$mine" -gt 0 ] || exit 0

marker="$gitdir/cm-ledger-reminded"
head=$(git rev-parse HEAD)
[ "$(cat "$marker" 2>/dev/null)" = "$head" ] && exit 0
echo "$head" >"$marker"

jq -n --arg r "You made $mine commit(s) since $file was last updated. Update its Now, Done, Next, Blocked on and Handing off sections, then commit and push it on its own (docs(ledger): ...)." '{decision: "block", reason: $r}'
