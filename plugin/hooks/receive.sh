#!/usr/bin/env bash

. "$(dirname "$0")/../lib.sh"
[ -n "$CM_URL" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

event=$(jq -r '.hook_event_name // empty' 2>/dev/null)
seen=$(read_seq "$SEEN")

brief=""
if [ "$event" = SessionStart ]; then
  if [ -s "$SESSION" ]; then
    brief=$(snapshot 2 | jq -r --slurpfile s "$SESSION" --arg me "$ACTOR" --arg inc "$INCIDENT" "$JQ_DEFS"'
      $s[0] as $s
      | "You are in incident \($inc) as \($me) on team \($s.team), manager \($s.manager | name_or_none), term \($s.term // "?").",
        "Teammates:", teammates($s; $me)
    ' 2>>"$LOG")
  else
    brief="CaptainMorgue: you have not joined $INCIDENT. Run /captainmorgue:join to get messages from the incident."
  fi
fi

result='{}'
if [ -s "$INBOX" ]; then
  result=$(jq -sc --argjson seen "$seen" --argjson max 5 "$JQ_DEFS"'
    (map(select(.seq > $seen)) | sort_by(.seq)) as $unread
    | ($unread | map(select(.kind != "vote_request"))) as $show
    | $show[:$max] as $shown
    | ($shown | map(.kind) | unique) as $kinds
    | {upto: (if ($show | length) > $max then $shown[-1].seq else ($unread[-1].seq // $seen) end),
       interrupt: any($kinds[]; IN("conflict", "ask", "escalation")),
       text: (if $shown == [] then "" else
         (["CaptainMorgue messages for you:"] + ($shown | map(msgline))
          + [$kinds[] | guidance[.] // empty]
          + (if ($show | length) > $max then ["\(($show | length) - $max) more unread: run /captainmorgue:inbox."] else [] end))
         | join("\n") end)}
  ' "$INBOX" 2>>"$LOG") || result='{}'
fi

upto=$(jq -r ".upto // $seen" <<<"$result")
text=$(jq -r '.text // ""' <<<"$result")

if [ "$event" = Stop ]; then
  [ "$(jq -r '.interrupt // false' <<<"$result")" = true ] || exit 0
  jq -n --arg r "$text" '{decision: "block", reason: $r}'
else
  context=$(printf '%s\n\n%s' "$brief" "$text" | sed '/./,$!d')
  [ -n "${context//[[:space:]]/}" ] && jq -n --arg e "$event" --arg c "$context" '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}}'
fi
[ "$upto" -gt "$seen" ] && ack "$upto"
exit 0
