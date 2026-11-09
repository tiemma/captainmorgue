#!/usr/bin/env bash

. "$(dirname "$0")/../lib.sh"

[ -n "$CM_URL" ] || exit 0
[ "${CM_APPROVALS:-}" = off ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

action=$(jq -r "$JQ_TARGET"'
  def bash_danger:
    [splits("\\s*(\\|\\||&&|;|\\||\\n)\\s*")][] as $seg
    | ([$seg | cli_args("kubectl")][0] | select(.) | .pos as $p | .ns as $ns
       | select(($p[0] | IN("delete", "drain"))
                or ($p[0] == "scale" and ($seg | test("--replicas(=|\\s+)\\W?0\\W?(\\s|$)")))
                or ($p[0] == "rollout" and ($p[1] | IN("restart", "undo")))
                or ($p[0:3] == ["argo", "rollouts", "undo"]))
       | "kubectl " + ($p | join(" ")) + (if $ns then " -n " + $ns else "" end)),
      ([$seg | cli_args("helm")][0] | select(.) | .pos as $p | .ns as $ns
       | select($p[0] | IN("uninstall", "delete"))
       | "helm " + ($p | join(" ")) + (if $ns then " -n " + $ns else "" end));

  def radar_danger:
    select(.tool_name | test("^mcp__radar[^_]*__(delete_resource|manage_[a-z_]+)$"))
    | (.tool_name | split("__") | last) as $tool
    | .tool_input as $in
    | select(if $tool == "delete_resource" then $in.dry_run == false
             else ($in.dry_run != true) and (($in.action | IN("restart", "delete", "uninstall", "drain")) or ($in.action == "scale" and ($in.replicas | tostring) == "0")) end)
    | [$tool, ($in.action // empty), ([$in.namespace, $in.kind, $in.name] | map(select(. != null and . != "")) | join("/"))] | join(" ");

  first(if .tool_name == "Bash" then .tool_input.command // "" | bash_danger else radar_danger end) // empty
' 2>>"$LOG")

[ -n "$action" ] || exit 0
list=$(api GET /approvals 2>>"$LOG") || { log "GET /approvals failed, allowing $action"; exit 0; }
jq -e --arg a "$ACTOR" --arg act "$action" 'any(.[]; .actor == $a and .action == $act and .usable)' <<<"$list" >/dev/null && exit 0

cm="$(cd "$(dirname "$0")/../bin" && pwd)/cm"
pending=$(jq -r --arg a "$ACTOR" --arg act "$action" '[.[] | select(.actor == $a and .action == $act and .status == "pending")][0] | select(.) | "Approval \(.id) is already pending with \(.approver); wait for it, then retry."' <<<"$list")
reason="This is a destructive action and needs your team manager's approval first. ${pending:-Request it with: $(printf '%q' "$cm") approve-request \"$action\" \"<why it is needed>\" and retry the same call once it is approved.}"
jq -nc --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
