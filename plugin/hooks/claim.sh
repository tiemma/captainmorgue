#!/usr/bin/env bash

. "$(dirname "$0")/../lib.sh"

[ -n "$CM_URL" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

claim=$(jq -c --arg actor "$ACTOR" "$JQ_TARGET"'
  def radar_write:
    select(.tool_name | test("^mcp__radar[^_]*__(apply_resource|patch_resource|delete_resource|manage_workload|manage_rollout|manage_helm|manage_gitops)$"))
    | (.tool_name | split("__") | last) as $tool
    | .tool_input as $in
    | select(if $tool == "delete_resource" then $in.dry_run == false else $in.dry_run != true end)
    | (if $tool == "apply_resource" then
         ($in.yaml // "") as $y
         | def field($re): [$y | capture($re).v][0];
         {kind: field("(?m)^kind:\\s*(?<v>\\S+)"),
          name: field("(?m)^\\s+name:\\s*(?<v>\\S+)"),
          namespace: ($in.namespace // field("(?m)^\\s+namespace:\\s*(?<v>\\S+)"))}
       else
         {kind: ({manage_helm: "HelmRelease", manage_rollout: "Rollout"}[$tool] // $in.kind // (if $tool == "manage_gitops" then "Application" else null end)),
          name: $in.name, namespace: $in.namespace}
       end) as $r
    | select(($r.kind | type) == "string" and ($r.name | type) == "string")
    | {write: true, verb: ($in.action // ($tool | sub("_resource$"; ""))),
       resource: ({kind: ($r.kind | kindof // $r.kind), name: $r.name}
                  + (if ($r.namespace | type) == "string" and $r.namespace != "" then {namespace: $r.namespace} else {} end))};

  first((if .tool_name == "Bash" then
     .tool_input.command // "" | (cli_args("kubectl") | kubectl_target), (cli_args("helm") | helm_target)
   else radar_write end)
  | select(.write))
  | {actor: $actor, text: .verb, resource}
' 2>>"$LOG")

[ -n "$claim" ] || exit 0
resp=$(api POST /claims "$claim" 2>>"$LOG") || { log "POST /claims failed, allowing"; exit 0; }
[ "$(jq -r '.granted' <<<"$resp" 2>/dev/null)" = false ] || exit 0
jq -c '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: .reason}}' <<<"$resp"
exit 0
