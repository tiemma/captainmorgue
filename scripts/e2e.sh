#!/usr/bin/env bash
set -u

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
port=${PORT:-18190}
token=e2e-$$
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
inject() {
  echo '{"hook_event_name":"UserPromptSubmit"}' | HOME=$work/home-$1 CM_ACTOR=$1 CM_TEAM=$2 "$root/plugin/hooks/receive.sh" | jq -r '.hookSpecificOutput.additionalContext // ""'
}
state() { curl -s -N --max-time 2 "$CM_URL/stream" | grep '^data' | tail -1 | sed 's/^data: //'; }

[ -n "${short:-}" ] && check "unauthenticated write is rejected" '[ "$(curl -s -o /dev/null -w %{http_code} -X POST "$CM_URL/heartbeat" -d "{\"actor\":\"dana\"}")" = 401 ]'

as dana registration join </dev/null >"$work/join-dana"
as gus registration join </dev/null >/dev/null
as ben platform join </dev/null >/dev/null
as dev platform join </dev/null >/dev/null
check "first to join manages the team" 'grep -q "manager dana" "$work/join-dana"'

echo '@dana Is confdb failing over?' | as gus registration ask >/dev/null
sleep 3
check "ask reaches the recipient's session" 'inject dana registration | grep -q "Is confdb failing over"'

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
