#!/usr/bin/env bash
set -u

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
port=${PORT:-18190}
token=e2e-$$
unset CM_ACTOR CM_TEAM CM_ROLE CM_TASK CM_REPO CM_TOOLS CM_LEDGER CM_INCIDENT
export CM_URL=${E2E_URL:-} CM_NOTIFY=off
fails=0

cleanup() {
  for h in "$work"/home-*; do [ -d "$h" ] && HOME=$h "$root/plugin/bin/cm" leave </dev/null >/dev/null 2>&1; done
  [ -n "${svc:-}" ] && kill "$svc" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 1' INT TERM HUP

check() {
  if eval "$2"; then echo "PASS $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

if [ -z "${CM_URL:-}" ]; then
  (cd "$root/service" && go build -o "$work/cm" .) || exit 1
  CM_TOKEN=$token ANTHROPIC_API_KEY= ELASTIC_URL= PORT=$port ROSTER="$root/roster.yaml" WEB_DIR="$root/web" \
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

trigger() { "$root/scripts/trigger.sh" "$@" >/dev/null; }
trigger checkin 'Check-in 5xx rate at 40%'
sleep 3
s=$(state)
manager() { jq -r --arg t "$1" '.teams[] | select(.id == $t) | .manager' <<<"$s"; }
reg=$(manager registration) plat=$(manager platform)
paged=$(inject "$reg" registration)
check "alert opens the incident titled from the alert" '[ "$(jq -r .incident.title <<<"$s")" = "checkin: Check-in 5xx rate at 40%" ] && [ "$(jq -r .incident.status <<<"$s")" = open ]'
check "draft record is documented while the incident is open" 'jq -e "any(.[]; .id == \"INC-1\" and .status == \"open\")" <<<"$(curl -s "$CM_URL/records")" >/dev/null'
check "alert pages the owning team's manager" 'grep -q "\[page\] .* from trigger" <<<"$paged" && grep -q "Let my agent investigate" <<<"$paged"'
check "everyone else hears who is paged" 'inject dev platform | grep -q "checkin alert: Check-in 5xx rate at 40%. Registration owns it; $reg is paged."'
trigger checkin 'Check-in 5xx rate at 55%'
sleep 3
check "repeat alert updates the signal without paging again" '[ "$(jq -r .signals.checkin.value <<<"$(state)")" = "Check-in 5xx rate at 55%" ] && ! inject "$reg" registration | grep -q "\[page\]"'
curl -sf -X POST -H "Authorization: Bearer ${CM_TOKEN:-}" -H 'Content-Type: application/json' "$CM_URL/alerts" -d '{"type":"alert.ongoing","data":{"issue":{"status":"critical","summary":"confdb p99 latency above 2s","labels":[{"key":"service.name","value":{"stringValue":"confdb"}}]}}}' >/dev/null
sleep 3
check "Dash0 webhook pages the owning manager" 'as "$plat" platform inbox | grep -q "\[page\] .* from dash0 .*: confdb alert: confdb p99 latency above 2s" && inject "$([ "$plat" = ben ] && echo dev || echo ben)" platform | grep -q "Platform owns it; $plat is paged"'
trigger checkin 'Check-in error rate back to normal' resolved
sleep 3
check "recovery reaches everyone and turns the signal ok" 'inject dev platform | grep -q "checkin recovered" && [ "$(jq -r .signals.checkin.status <<<"$(state)")" = ok ]'

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

if [ -n "${short:-}" ]; then
  echo 'investigating checking checkin' | as gus registration status-set >/dev/null
  echo 'sev2' | as gus registration status-set >/dev/null
  echo 'mitigated rolled back checkin' | as ben platform status-set >/dev/null
  refused=$(echo 'resolved' | as gus registration status-set)
  s=$(state)
  check "anyone moves the incident to investigating and mitigated, and sets severity" '[ "$(jq -r ".incident.status + \" \" + .incident.severity" <<<"$s")" = "mitigated sev2" ]'
  check "only the commander may resolve" 'grep -q "only the commander" <<<"$refused"'
  echo 'Radar investigation: checkin OOMKilled after the 2.3 release' | as dana registration note >/dev/null
  echo '--part checkin-oom checkin pods OOMKilled at 512Mi' | as dana registration note >/dev/null
  echo 'mitigated --part checkin-oom raised the limit' | as ben platform status-set >/dev/null
  check "a part named in a note is resolved by a status naming it" 'jq -e "[.parts[] | select(.name == \"checkin-oom\" and .owner == \"dana\" and .status == \"mitigated\" and .resolved_at != null and .note == \"checkin pods OOMKilled at 512Mi\")] | length == 1" <<<"$(state)" >/dev/null && [ "$(jq -r .incident.status <<<"$(state)")" = mitigated ]'
  auth=(-H "Authorization: Bearer $CM_TOKEN" -H 'Content-Type: application/json')
  curl -s -o /dev/null "${auth[@]}" -X POST "$CM_URL/messages" -d '{"from":"dana","to":["dev"],"kind":"ask","text":"unread check"}'
  inbox=$(curl -s "${auth[@]}" "$CM_URL/inbox/dev?wait=0")
  check "inbox reports unread messages after the acked cursor" 'jq -e ".unread >= 1 and .unread == (.messages | length)" <<<"$inbox" >/dev/null'
  curl -s -o /dev/null "${auth[@]}" -X POST "$CM_URL/inbox/dev/ack" -d "{\"seq\":$(jq .cursor <<<"$inbox")}"
  check "ack clears unread" '[ "$(curl -s "${auth[@]}" "$CM_URL/inbox/dev?wait=0" | jq .unread)" = 0 ]'
  echo '@ben Add a memory alert on checkin' | as dana registration action >/dev/null
  pr=https://github.com/tiemma/captainmorgue-cluster/pull/99
  echo "$pr checkin" | as dana registration pr >/dev/null
  check "pull request shows in state" 'jq -e --arg u "$pr" ".prs[] | select(.service == \"checkin\" and .url == \$u and .author == \"dana\")" <<<"$(state)" >/dev/null'
  check "fix points to the open pull request instead of opening another" 'echo "checkin raise the memory limit" | as dev platform fix | grep -q "already open in INC-1: $pr"'
  post() { curl -s -o /dev/null -X POST "$CM_URL/events" -H "Authorization: Bearer $CM_TOKEN" -d "$1"; }
  post '{"actor":"dana","type":"action","text":"Bash: kubectl -n team-captainmorgue rollout undo deploy/checkin (ok)","resource":{"kind":"Deployment","namespace":"team-captainmorgue","name":"checkin"},"duration_ms":840}'
  post '{"actor":"dana","type":"action","text":"Bash: curl -fs http://checkin/healthz (failed)","exit_code":7}'
  s=$(state)
  check "state counts come from the service" 'jq -e ".counts.events > 0 and .counts.parts == (.parts | length) and .counts.claims == (.claims | length) and .counts.crew_total == (.people | length) and .counts.crew_online == ([.people[] | select(.status == \"online\")] | length) and .counts.open_prs == (.prs | length) and .counts.open_asks >= 1 and .counts.action_items == 1" <<<"$s" >/dev/null'
  check "close via events is refused for anyone but the commander" '[ "$(curl -s -o /dev/null -w %{http_code} "${auth[@]}" -X POST "$CM_URL/events" -d "{\"actor\":\"dev\",\"type\":\"close\",\"text\":\"done\"}")" = 403 ]'
  echo 'resolved' | as dana registration status-set >/dev/null
  echo 'Rolled back checkin and raised its memory limit' | as dana registration close >/dev/null &
  close_a=$!
  curl -s -o /dev/null "${auth[@]}" -X POST "$CM_URL/events" -d '{"actor":"dana","type":"close","text":"Rolled back checkin and raised its memory limit"}' &
  wait "$close_a" $!
  sleep 3
  rec=$(curl -s "$CM_URL/record/INC-1")
  check "two closes write one close and one RFO" 'jq -e "([.events[] | select(.type == \"close\")] | length == 1) and ([.events[] | select(.actor == \"captainmorgue\" and .type == \"action\" and .to == [\"ben\"])] | length == 1)" <<<"$rec" >/dev/null'
  check "close after close is a conflict" '[ "$(curl -s -o /dev/null -w %{http_code} "${auth[@]}" -X POST "$CM_URL/events" -d "{\"actor\":\"dana\",\"type\":\"close\"}")" = 409 ]'

  check "close writes the RFO from events" 'jq -e ".status == \"closed\" and .written_by == \"captainmorgue\" and (.root_cause | test(\"OOMKilled\")) and .window.mitigated != null and .window.resolved != null and (.timeline | length) > 0 and (.went_well | length) > 0 and (.errors | length) > 0" <<<"$rec" >/dev/null'
  check "RFO lists the pull request and the action item with an owner and due hint" 'jq -e --arg u "$pr" "(.remediation[0].url == \$u) and (.action_items[] | select(.owner == \"ben\" and .due == \"within 1 week\"))" <<<"$rec" >/dev/null'
  check "action item owner gets it in their inbox" 'as ben platform inbox | grep -A3 "\[action\]" | grep -q "Add a memory alert on checkin"'
  check "status lists action items after close" 'as ben platform status </dev/null | grep -q "@ben: Add a memory alert on checkin"'
  check "RFO lists each step taken, the failure and the cluster change" 'jq -e "([.steps[].steps[] | select(.actor == \"dana\")] | any(.text | test(\"rollout undo deploy/checkin\")) and any(.failed and .exit_code == 7)) and any(.changes[]; .resource == \"Deployment/checkin\" and .duration_ms == 840)" <<<"$rec" >/dev/null && curl -s "$CM_URL/record/INC-1.md" | grep -q "^## Changes made"'
  check "archive lists the closed incident and the record keeps improvements" 'jq -e ".[0].id == \"INC-1\" and .[0].severity == \"sev2\"" <<<"$(curl -s "$CM_URL/records")" >/dev/null && jq -e ".improvements | length > 0" <<<"$rec" >/dev/null'
  check "RFO served as markdown" 'curl -s "$CM_URL/record/INC-1.md" | grep -q "^## Action items" && curl -s "$CM_URL/record/INC-1.md" | grep -q "checkin: $pr"'
  check "close finalises the draft record" 'jq -e ".[0].id == \"INC-1\" and .[0].status == \"closed\"" <<<"$(curl -s "$CM_URL/records")" >/dev/null'
  before=$(curl -s "$CM_URL/record/INC-1" | jq -S 'del(.events)')
  trigger checkin 'Check-in 5xx rate at 30% again'
  sleep 3
  check "a new alert after close opens INC-2" '[ "$(jq -r ".incident.id + \" \" + .incident.status" <<<"$(state)")" = "INC-2 open" ]'
  check "INC-1 record is unchanged after INC-2 opens" '[ "$(curl -s "$CM_URL/record/INC-1" | jq -S "del(.events)")" = "$before" ]'
  check "records list both incidents with full RFO sections" 'jq -e "(.[0].id == \"INC-2\" and .[0].status == \"open\") and any(.[]; .id == \"INC-1\" and (.timeline | length) > 0 and (.went_well | length) > 0 and .window.closed != null)" <<<"$(curl -s "$CM_URL/records?full=1")" >/dev/null'
  check "status on the default id moves the open incident" 'echo "investigating checking checkin again" | as gus registration status-set | grep -q "INC-2 is investigating"'
fi

[ "$fails" -eq 0 ] && echo "ALL PASSED" || { echo "$fails FAILED"; [ -f "$work/service.log" ] && tail -20 "$work/service.log"; exit 1; }
