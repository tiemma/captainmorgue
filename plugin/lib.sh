CM_DIR="$HOME/.captainmorgue"
LOG="$CM_DIR/hook.log"
ACTOR="${CM_ACTOR:-${USER:-$USERNAME}}"
INBOX="$CM_DIR/inbox.jsonl"
SEEN="$CM_DIR/seen"
SESSION="$CM_DIR/session.json"
ANSWERED="$CM_DIR/answered"
HELD="$CM_DIR/held"

mkdir -p "$CM_DIR"

case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN*) jq() { command jq -b "$@"; } ;;
esac

INCIDENT="${CM_INCIDENT:-$(jq -r '.incident // empty' "$SESSION" 2>/dev/null)}"
INCIDENT="${INCIDENT:-INC-1}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"
}

api() {
  local args=(-sSN --fail-with-body --max-time "${CM_MAX_TIME:-2}" -X "$1" -H 'Content-Type: application/json')
  [ -n "${3:-}" ] && args+=(-d "$3")
  { [ -n "${CM_TOKEN:-}" ] && printf 'header = "Authorization: Bearer %s"\n' "$CM_TOKEN"; } | curl --config - "${args[@]}" "${CM_URL%/}$2"
}

poller_alive() {
  local cmd
  [ -n "$1" ] || return 1
  if cmd=$(ps -p "$1" -o command= 2>/dev/null); then
    case $cmd in *cm-poll*) return 0 ;; esac
    return 1
  fi
  kill -0 "$1" 2>/dev/null
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
    "$(jq -nc --arg a "$ACTOR" --arg t "$1" --arg role "$2" --arg task "$3" --arg repo "${CM_REPO:-}" --arg tools "${CM_TOOLS:-$(cat "$CM_DIR/tools" 2>/dev/null)}" --arg quiet "${CM_QUIET_JOIN:-}" '
      {actor: $a, role: $role, task: $task, repo: $repo, tools: ($tools | [splits(",") | gsub("^\\s+|\\s+$"; "") | select(. != "")])}
      + (if $t != "" then {team: $t} else {} end) + (if $quiet != "" then {quiet: true} else {} end)')" 2>>"$LOG") || return 1
  cursor=$(jq -r '.cursor // 0' <<<"$resp")
  write_file "$SESSION" "$resp"
  write_file "$CM_DIR/cursor" "$cursor"
  write_file "$SEEN" "$cursor"
  : >"$INBOX"
  rm -f "$ANSWERED" "$HELD"
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

JQ_TARGET='
def kinds: {
  deploy: "Deployment", deployment: "Deployment", deployments: "Deployment",
  rollout: "Rollout", rollouts: "Rollout", ro: "Rollout",
  pod: "Pod", pods: "Pod", po: "Pod",
  svc: "Service", service: "Service", services: "Service",
  sts: "StatefulSet", statefulset: "StatefulSet", statefulsets: "StatefulSet",
  ds: "DaemonSet", daemonset: "DaemonSet", daemonsets: "DaemonSet",
  rs: "ReplicaSet", replicaset: "ReplicaSet", replicasets: "ReplicaSet",
  job: "Job", jobs: "Job", cronjob: "CronJob", cronjobs: "CronJob", cj: "CronJob",
  cm: "ConfigMap", configmap: "ConfigMap", configmaps: "ConfigMap",
  secret: "Secret", secrets: "Secret",
  cluster: "Cluster", clusters: "Cluster",
  node: "Node", nodes: "Node", no: "Node",
  ns: "Namespace", namespace: "Namespace", namespaces: "Namespace",
  pvc: "PersistentVolumeClaim", persistentvolumeclaim: "PersistentVolumeClaim",
  ing: "Ingress", ingress: "Ingress", ingresses: "Ingress",
  hpa: "HorizontalPodAutoscaler", horizontalpodautoscaler: "HorizontalPodAutoscaler"
};
def kindof: kinds[ascii_downcase | split(".")[0]];
def objname: test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$");
def valueflags: "-o", "--output", "-l", "--selector", "-c", "--container", "--context",
  "-f", "--filename", "--kubeconfig", "--cluster", "--user", "-p", "--patch", "--type",
  "--values", "--set", "--set-string", "--set-file", "--version", "--repo", "--kube-context", "--timeout";

def cli_args($bin):
  [splits("\\s*(\\|\\||&&|;|\\||\\n)\\s*")]
  | .[] | select(test("(^|\\s)" + $bin + "\\s"))
  | capture($bin + "\\s+(?<a>.*)").a
  | [splits("\\s+") | explode | map(select(. != 34 and . != 39)) | implode | select(length > 0)]
  | reduce .[] as $t ({pos: [], ns: null, want: null};
      if .want == "ns" then .ns = $t | .want = null
      elif .want then .want = null
      elif ($t | test("^(-n|--namespace)=")) then .ns = ($t | sub("^[^=]*="; ""))
      elif $t == "-n" or $t == "--namespace" then .want = "ns"
      elif ($t | IN(valueflags)) then .want = "skip"
      elif ($t | startswith("-")) then .
      else .pos += [$t] end);

def kubectl_target:
  .ns as $ns
  | .pos as $p
  | (if $p[0:2] == ["argo", "rollouts"] then
      ($p[3:] | map(select(kindof != "Rollout")) | .[0]) as $n
      | {read: ($p[2] | IN("get", "status", "list", "version")),
        write: ($p[2] | IN("promote", "abort", "undo")), verb: ("argo rollouts " + $p[2]),
        kind: "Rollout", name: $n}
    else
      ([$p[1:][] | select(test("^[A-Za-z.]+/[^/]+$")) | split("/") | {kind: (.[0] | kindof), name: .[1]} | select(.kind)][0]
       // ([range(1; ($p | length) - 1) as $i | select($p[$i] | kindof) | {kind: ($p[$i] | kindof), name: $p[$i + 1]}][0]))
      + {read: (($p[0] | IN("get", "describe", "logs", "top", "explain", "events", "diff"))
                or ($p[0] == "rollout" and ($p[1] | IN("status", "history")))),
         write: (($p[0] | IN("apply", "patch", "delete", "scale", "edit", "set", "annotate", "label"))
                 or ($p[0] == "rollout" and ($p[1] | IN("status", "history") | not)))}
    end)
  | select(.name and (.name | objname))
  | {read, write, verb: (.verb // ($p[0:2] | map(select(kindof == null and (test("/") | not))) | join(" "))),
     resource: ({kind, name} + (if $ns then {namespace: $ns} else {} end))};

def helm_target:
  .ns as $ns
  | select(.pos[0] | IN("upgrade", "install", "rollback", "uninstall", "delete"))
  | select(.pos[1] and (.pos[1] | objname))
  | {read: false, write: true, verb: ("helm " + .pos[0]),
     resource: ({kind: "HelmRelease", name: .pos[1]} + (if $ns then {namespace: $ns} else {} end))};
'

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
  ask: "For each ask: stop what you are doing. Show the ask to the person verbatim (seq, sender, why, text), then ask them how to answer with the AskUserQuestion tool, one question per ask, with the options \"Reply\" (they type the answer), \"I am on it\", \"Not me, route to someone\" and \"Let my agent handle it\". Reply: send their text. I am on it: send \"On it\". Route: ask who, run /captainmorgue:ask @them with the question and who asked it, then reply \"Not me, asked @them\". Let my agent handle it: do the work in a subagent (Agent tool) so their own task is not derailed, then reply with the result. Send every answer with /captainmorgue:reply <seq> <text>, then resume what you were doing. If nobody answers within 60 s, CaptainMorgue auto-replies with their current status.",
  conflict: "For each conflict: show it to the person now and stop any risky work on that resource until they decide.",
  escalation: "For each escalation: show it to the person now.",
  page: "For each page: you are paged to start triage on a service your team owns. Stop what you are doing. Show the alert to the person verbatim (seq, sender, why, text), then ask them with the AskUserQuestion tool, one question per page, with the options \"I will take it\", \"Hand off to someone\" and \"Let my agent investigate\". Take it: run /captainmorgue:task Triage <service> alert, then /captainmorgue:broadcast root I have the <service> alert. Hand off: ask who, run /captainmorgue:ask @them Can you take the <service> alert? plus the alert text, then /captainmorgue:task Handed <service> alert to @them. Let my agent investigate: run /captainmorgue:task Agent investigating <service>, then in a subagent (Agent tool) read the service with the Radar MCP (pods, events, recent changes, logs) and the Dash0 MCP (error rate, latency, failing traces), report the likely cause and a proposed fix to the person, and broadcast a one-line finding with /captainmorgue:broadcast root. Never change the cluster without the person approving it.",
  alert: "For an alert: tell the person in one line which service is alerting, which team owns it and who is paged.",
  recovered: "For a recovery: tell the person the service recovered. If they are the commander and the fix is confirmed, suggest closing the incident.",
  digest: "For a digest: give the person this catch-up in a few lines before going on.",
  action: "For action items: tell the person which follow-ups from the incident record they own.",
  approval_request: "For each approval request: a teammate'"'"'s agent wants to run a destructive action and you approve it. Show it to the person verbatim (approval id, who, action, why), then ask them with the AskUserQuestion tool, one question per request, with the options \"Approve\" and \"Deny\". Approve: run /captainmorgue:approve <id>. Deny: ask why, then run /captainmorgue:deny <id> <why>. Never decide for them.",
  approval: "For an approval decision: tell the person in one line. If approved, retry the exact call that was blocked; if denied, do not run it and tell them why."
};
'
