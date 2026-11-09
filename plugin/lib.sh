CM_DIR="$HOME/.captainmorgue"
LOG="$CM_DIR/hook.log"
ACTOR="${CM_ACTOR:-$USER}"
INCIDENT="${CM_INCIDENT:-INC-1}"
INBOX="$CM_DIR/inbox.jsonl"
SEEN="$CM_DIR/seen"
SESSION="$CM_DIR/session.json"

mkdir -p "$CM_DIR"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"
}

api() {
  local args=(-sSfN --max-time "${CM_MAX_TIME:-2}" -X "$1" -H 'Content-Type: application/json')
  [ -n "${3:-}" ] && args+=(-d "$3")
  { [ -n "${CM_TOKEN:-}" ] && printf 'header = "Authorization: Bearer %s"\n' "$CM_TOKEN"; } | curl --config - "${args[@]}" "${CM_URL%/}$2"
}

write_file() {
  printf '%s\n' "$2" >"$1.tmp" && mv "$1.tmp" "$1"
}

read_seq() {
  local v
  v=$(cat "$1" 2>/dev/null)
  printf '%s' "${v:-0}"
}

ack() {
  write_file "$SEEN" "$1"
  (CM_MAX_TIME=3 api POST "/inbox/$ACTOR/ack" "{\"seq\":$1}" >/dev/null 2>>"$LOG" &)
}

join_incident() {
  local resp cursor
  resp=$(CM_MAX_TIME=5 api POST "/incidents/$INCIDENT/join" \
    "$(jq -nc --arg a "$ACTOR" --arg t "$1" --arg role "$2" --arg task "$3" --arg repo "${CM_REPO:-}" --arg tools "${CM_TOOLS:-}" '
      {actor: $a, role: $role, task: $task, repo: $repo, tools: ($tools | [splits(",") | gsub("^\\s+|\\s+$"; "") | select(. != "")])}
      + (if $t != "" then {team: $t} else {} end)')" 2>>"$LOG") || return 1
  cursor=$(jq -r '.cursor // 0' <<<"$resp")
  write_file "$SESSION" "$resp"
  write_file "$CM_DIR/cursor" "$cursor"
  write_file "$SEEN" "$cursor"
  : >"$INBOX"
  printf '%s\n' "$resp"
}

snapshot() {
  local f="$CM_DIR/stream.$$" deadline=$((SECONDS + ${1:-3})) pid
  CM_MAX_TIME="${1:-3}" api GET /stream >"$f" 2>/dev/null &
  pid=$!
  until awk '/^event: state/ { s = 1 } s && /^data: / { d = 1 } d && /^$/ { found = 1 } END { exit !found }' "$f" ||
    [ "$SECONDS" -ge "$deadline" ] || ! kill -0 "$pid" 2>/dev/null; do
    sleep 0.1
  done
  kill "$pid" 2>/dev/null
  awk '
    /^event: / { name = substr($0, 8) }
    /^data: / { d = substr($0, 7); if (name == "state") { print "{\"state\":" d "}"; exit } print "{\"event\":" d "}" }
  ' "$f" | jq -sc '{events: [.[].event | select(.)], state: (map(.state | select(.))[0] // {})}'
  rm -f "$f"
}

JQ_DEFS='
def name_or_none: if (. // "") == "" then "none" else . end;
def status_of($a): if .state.people == null then "unknown" else (.state.people[$a] // "offline") | if type == "object" then .status // "unknown" else . end end;
def team_of($a): (.state.people[$a] | objects | .team) // ([.state.teams[]? | select(.manager == $a or (.members | index($a))) | .id][0]) // "?";
def members_of($t): [.state.teams[]? | select(.id == $t) | (.manager | strings | select(. != "")), .members[]?] | unique;
def latest($a; $n): [.events[] | select(.actor == $a)] | .[-$n:];
def evline: "\(.ts // "" | .[11:16]) \(.type): \(.text)";
def manages($a): any(.state.teams[]?; .manager == $a);
def prof($a): (.state.people[$a] | objects) // {};
def roles($a): (prof($a).role // "responder") + (if manages($a) then ", team manager" else "" end);
def task_of($a): prof($a).task // "" | if . == "" then "not set" else . end;
def kit($a): prof($a) | [(.repo // "" | select(. != "") | "repo: \(.)"), (.tools // [] | select(. != []) | "tools: \(join(", "))")] | join("; ");
def commander: [.state.people // {} | to_entries[] | select(.value | objects | .role == "commander") | .key][0] | name_or_none;
def person($a; $n): (latest($a; $n) | map(evline) | if . == [] then ["no events yet"] else . end) as $lines
  | "- \($a) (\(status_of($a)), team \(team_of($a)), \(roles($a)))",
    "    working on: \(task_of($a))",
    (kit($a) | select(. != "") | "    " + .),
    ($lines[] | "    " + .);
def teammates($s; $me): ((members_of($s.team) | if . == [] then [$s.members[]?.actor] else . end) - [$me])[] as $a | person($a; 1);
def msgline: "- [\(.kind)] seq \(.seq) from \(.from)\(if .why and .why != "" then " (why: \(.why))" else "" end): \(.text)";
def guidance: {
  ask: "For each ask: show it to the person verbatim with the sender and why, and ask them how to answer. If answering needs investigation, do it in a subagent (Agent tool) so their own task is not derailed, then propose a reply. Send only after the person approves, with /captainmorgue:reply <seq> <text>. If they do not answer within 60 s, CaptainMorgue auto-replies with their current status.",
  conflict: "For each conflict: show it to the person now and stop any risky work on that resource until they decide.",
  escalation: "For each escalation: show it to the person now."
};
'
