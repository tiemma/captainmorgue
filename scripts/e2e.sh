#!/usr/bin/env bash
set -u

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
port=${PORT:-18190}
token=e2e-$$
export CM_ALERT_SECONDS=${CM_ALERT_SECONDS:-1}
fails=0

cleanup() {
  for h in "$work"/home-*; do [ -d "$h" ] && HOME=$h "$root/plugin/bin/cm" leave </dev/null >/dev/null 2>&1; done
  [ -n "${svc:-}" ] && kill "$svc" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT

check() {
  if eval "$2"; then echo "PASS $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

if [ -z "${CM_URL:-}" ]; then
  (cd "$root/service" && go build -o "$work/cm" .) || exit 1
  CM_TOKEN=$token PORT=$port ROSTER="$root/roster.yaml" WEB_DIR="$root/web" \
    CM_SUSPECT_AFTER=3s CM_OFFLINE_AFTER=6s CM_ASK_TIMEOUT=8s "$work/cm" >"$work/service.log" 2>&1 &
  svc=$!
  export CM_URL=http://localhost:$port CM_TOKEN=$token
  for _ in $(seq 50); do curl -fs "$CM_URL/healthz" >/dev/null && break; sleep 0.2; done
  short=1
fi

as() {
  local actor=$1 team=$2; shift 2
  mkdir -p "$work/home-$actor"
  HOME=$work/home-$actor CM_ACTOR=$actor CM_TEAM=$team "$root/plugin/bin/cm" "$@"
}
hook() {
  echo "{\"hook_event_name\":\"$3\"}" | HOME=$work/home-$1 CM_ACTOR=$1 CM_TEAM=$2 "$root/plugin/hooks/receive.sh"
}
inject() {
  hook "$1" "$2" UserPromptSubmit | jq -r '.hookSpecificOutput.additionalContext // ""'
}
pretool() {
  jq -nc --arg c "$2" '{hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: $c}}' |
    HOME=$work/home-$1 CM_ACTOR=$1 "$root/plugin/hooks/claim.sh"
}
state() { curl -s -N --max-time 2 "$CM_URL/stream" | grep '^data' | tail -1 | sed 's/^data: //'; }

[ -n "${short:-}" ] && check "unauthenticated write is rejected" '[ "$(curl -s -o /dev/null -w %{http_code} -X POST "$CM_URL/heartbeat" -d "{\"actor\":\"dana\"}")" = 401 ]'

echo 'commander Restore check-in at Hall B' | CM_REPO=conference CM_TOOLS='kubectl, radar' as dana registration join >"$work/join-dana"
echo 'commander' | as gus registration join >"$work/join-gus"
as ben platform join </dev/null >/dev/null
as dev platform join </dev/null >/dev/null
check "first to join manages the team" 'grep -q "manager dana" "$work/join-dana"'
check "only one commander per incident" 'grep -q "Commander is already dana; you joined as responder" "$work/join-gus"'

echo '@dana' | as ben platform status >"$work/status-dana"
check "role and profile visible to another member" 'grep -q "(online, team registration, commander, team manager)" "$work/status-dana" && grep -q "repo: conference; tools: kubectl, radar" "$work/status-dana" && grep -q "working on: Restore check-in at Hall B" "$work/status-dana"'

echo 'Rolling back checkin' | as dana registration task >/dev/null
check "task update visible to another member" 'echo registration | as dev platform status | grep -q "working on: Rolling back checkin"'

echo '@dana Is confdb failing over?' | as gus registration ask >/dev/null
sleep 3
out=$(hook dana registration UserPromptSubmit)
check "ask reaches the recipient's session" 'jq -r .hookSpecificOutput.additionalContext <<<"$out" | grep -q "Is confdb failing over"'
check "ask is shown to the person in chat" 'jq -r .systemMessage <<<"$out" | grep -q "Is confdb failing over"'
check "ask tells Claude to ask the person with AskUserQuestion" 'jq -r .hookSpecificOutput.additionalContext <<<"$out" | grep -q "AskUserQuestion"'
check "unanswered ask holds the turn once" 'hook dana registration Stop | jq -e ".decision == \"block\"" >/dev/null && [ -z "$(hook dana registration Stop)" ]'

echo 'root Check-in is slow at Hall B' | as dana registration broadcast >/dev/null
sleep 3
check "broadcast to everyone reaches another team" 'inject dev platform | grep -q "Check-in is slow"'

seq_ask=$(echo '@ben What changed on confdb?' | as dev platform ask | sed -n 's/.*seq \([0-9]*\).*/\1/p')
echo "$seq_ask Nothing on our side" | as ben platform reply >/dev/null
sleep 2
check "reply goes back to the asker" 'inject dev platform | grep -q "Nothing on our side"'

as kim registration join </dev/null >/dev/null
sleep 3
late=$(inject kim registration)
check "late joiner gets a digest naming the earlier broadcast" 'grep -q "\[digest\]" <<<"$late" && grep -q "Check-in is slow" <<<"$late"'

write='kubectl -n team-captainmorgue rollout restart deploy/confdb'
check "first write claims the resource" '[ -z "$(pretool dana "$write")" ] && jq -e ".claims[] | select(.key == \"team-captainmorgue/deployment/confdb\" and .actor == \"dana\")" <<<"$(state)" >/dev/null'
denied=$(pretool dev "$write")
check "second actor's write is denied naming the holder" '[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$denied")" = deny ] && jq -r .hookSpecificOutput.permissionDecisionReason <<<"$denied" | grep -q "held by dana"'
check "read is never blocked" '[ -z "$(pretool dev "kubectl -n team-captainmorgue get pods")" ]'
check "holder renews its own claim" '[ -z "$(pretool dana "$write")" ]'
sleep 2
check "holder is told someone was blocked" 'inject dana registration | grep -q "dev tried to"'

if [ -n "${short:-}" ]; then
  kill "$(cat "$work/home-ben/.captainmorgue/poll.pid" 2>/dev/null)" 2>/dev/null
  echo '@ben Are you there?' | as dana registration ask >/dev/null
  sleep 15
  s=$(state)
  check "silent member goes offline" '[ "$(jq -r ".people.ben.status" <<<"$s")" = offline ]'
  check "team elects a new manager" '[ "$(jq -r ".teams[] | select(.id==\"platform\") | .manager" <<<"$s")" = dev ]'
  check "unanswered ask auto-replies" 'inject dana registration | grep -qi "has not seen your ask"'
  HOME=$work/home-ben CM_ACTOR=ben CM_TEAM=platform nohup "$root/plugin/bin/cm-poll" </dev/null >/dev/null 2>&1 &
  sleep 4
  check "returning member gets a digest naming the unanswered ask" 'as ben platform inbox | sed -n "/\[digest\]/,\$p" | grep -q "Are you there"'
else
  echo "SKIP liveness, election and auto-reply (needs short timings; run without CM_URL)"
fi

[ "$fails" -eq 0 ] && echo "ALL PASSED" || { echo "$fails FAILED"; [ -f "$work/service.log" ] && tail -20 "$work/service.log"; exit 1; }
