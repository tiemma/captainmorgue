#!/usr/bin/env bash

. "$(dirname "$0")/../lib.sh"

[ -n "$CM_URL" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

event=$(jq -c --arg actor "$ACTOR" --arg team "${CM_TEAM:-}" --arg inc "$INCIDENT" "$JQ_TARGET"'
  def trunc($n): if length > $n then .[:$n] + "..." else . end;
  def bash_target:
    .tool_input.command // "" | cli_args("kubectl") | kubectl_target;

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
  | {incident_id: $inc, actor: $actor, type: "action"} + (if $team != "" then {team: $team} else {} end) + .
' 2>&1) || { log "map failed: $event"; exit 0; }

if [ -n "$event" ] && ! out=$(api POST /events "$event" 2>&1); then
  log "POST /events failed: $out"
fi
exit 0
