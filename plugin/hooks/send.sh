#!/usr/bin/env bash

LOG="$HOME/.captainmorgue/hook.log"

log() {
  mkdir -p "${LOG%/*}" && printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"
}

post() {
  local out
  if ! out=$(curl -sS -f --max-time 2 -H 'Content-Type: application/json' -d "$2" "${CM_URL%/}$1" 2>&1); then
    log "POST $1 failed: $out"
    return 1
  fi
}

if [ -z "$CM_URL" ]; then
  [ "$1" = broadcast ] && echo "CM_URL is not set, nothing was broadcast."
  exit 0
fi
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

ACTOR="${CM_ACTOR:-$USER}"

if [ "$1" = broadcast ]; then
  text=$(cat)
  if [ -z "${text//[[:space:]]/}" ]; then
    echo "Nothing to broadcast: add the message after the command."
    exit 0
  fi
  body=$(jq -nc --arg from "$ACTOR" --arg text "$text" '{incident_id: "INC-1", from: $from, text: $text}')
  if post /broadcast "$body"; then
    echo "Broadcast sent to $CM_URL as $ACTOR."
  else
    echo "Broadcast failed, see $LOG."
  fi
  exit 0
fi

event=$(jq -c --arg actor "$ACTOR" --arg team "$CM_TEAM" '
  def trunc($n): if length > $n then .[:$n] + "..." else . end;
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
    "-f", "--filename", "--kubeconfig", "--cluster", "--user", "-p", "--patch", "--type";

  def kubectl_args:
    [splits("\\s*(\\|\\||&&|;|\\||\\n)\\s*")]
    | map(select(test("(^|\\s)kubectl\\s")))[0] // empty
    | capture("kubectl\\s+(?<a>.*)").a
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
          kind: "Rollout", name: $n}
      else
        ([$p[1:][] | select(test("^[A-Za-z.]+/[^/]+$")) | split("/") | {kind: (.[0] | kindof), name: .[1]} | select(.kind)][0]
         // ([range(1; ($p | length) - 1) as $i | select($p[$i] | kindof) | {kind: ($p[$i] | kindof), name: $p[$i + 1]}][0]))
        + {read: (($p[0] | IN("get", "describe", "logs", "top", "explain", "events", "diff"))
                  or ($p[0] == "rollout" and ($p[1] | IN("status", "history"))))}
      end)
    | select(.name and (.name | objname))
    | {read, resource: ({kind, name} + (if $ns then {namespace: $ns} else {} end))};

  def bash_target:
    .tool_input.command // "" | kubectl_args | kubectl_target;

  def radar_target:
    select(.tool_name | test("^mcp__.*radar"; "i"))
    | .tool_input as $in
    | select(($in.kind | type) == "string" and ($in.name | type) == "string" and $in.kind != "" and $in.name != "")
    | {read: (.tool_name | split("__") | last | test("^(get|list|describe|read|search|query|show|watch)|logs|events"; "i")),
       resource: ({kind: ($in.kind | kindof // $in.kind), name: $in.name}
                  + (if ($in.namespace | type) == "string" and $in.namespace != "" then {namespace: $in.namespace} else {} end))};

  def tool_event:
    (if .tool_name == "Bash" then (first(bash_target) // null) else (first(radar_target) // null) end) as $t
    | (.tool_input.command // .tool_input.file_path // .tool_input.notebook_path
       // (if $t then "\($t.resource.kind)/\($t.resource.name)" else null end)) as $detail
    | (if .hook_event_name == "PostToolUse" then "ok" elif .is_interrupt then "interrupted" else "failed" end) as $status
    | {text: ((if $t.read then "Checked: " else "" end)
              + .tool_name + (if $detail then ": " + ($detail | trunc(300)) else "" end)
              + " (" + $status + ")")}
      + (if $t then {resource: $t.resource} else {} end);

  (if .hook_event_name == "UserPromptSubmit" then
     (.prompt // "" | gsub("^\\s+|\\s+$"; "")) | select(length > 0 and (startswith("/") | not)) | {text: trunc(300)}
   elif .hook_event_name == "PostToolUse" or .hook_event_name == "PostToolUseFailure" then tool_event
   else empty end)
  | {incident_id: "INC-1", actor: $actor, type: "action"} + (if $team != "" then {team: $team} else {} end) + .
' 2>&1) || { log "map failed: $event"; exit 0; }

[ -n "$event" ] && post /events "$event"
exit 0
