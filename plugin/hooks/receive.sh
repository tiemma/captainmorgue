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
  result=$(jq -sc --argjson seen "$seen" --argjson max 5 --arg me "$ACTOR" --slurpfile done <(cat "$ANSWERED" "$HELD" 2>/dev/null) "$JQ_DEFS"'
    def handled: .seq as $q | any($done[]; . == $q);
    (map(select(.seq > $seen)) | sort_by(.seq)) as $unread
    | ($unread | map(select(.kind != "vote_request" and (.kind != "ask" or (handled | not))))) as $show
    | $show[:$max] as $shown
    | ($shown | map(.kind) | unique) as $kinds
    | map(select(.kind == "ask" and .from != $me and .seq <= $seen and (handled | not))) as $pending
    | {upto: (if ($show | length) > $max then $shown[-1].seq else ($unread[-1].seq // $seen) end),
       interrupt: any($kinds[]; IN("conflict", "ask", "escalation")),
       text: (if $shown == [] then "" else
         (["CaptainMorgue messages for you:"] + ($shown | map(msgline))
          + [$kinds[] | guidance[.] // empty]
          + (if ($show | length) > $max then ["\(($show | length) - $max) more unread: run /captainmorgue:inbox."] else [] end))
         | join("\n") end),
       pending: (if $pending == [] then "" else (["Unanswered CaptainMorgue asks for you:"] + ($pending | map(msgline)) + [guidance.ask]) | join("\n") end),
       note: ($shown | map(msgline) | join("\n")),
       stopnote: ($shown + $pending | map(msgline) | join("\n")),
       hold: [($shown + $pending)[] | select(.kind == "ask") | .seq]}
  ' "$INBOX" 2>>"$LOG") || result='{}'
fi

upto=$(jq -r ".upto // $seen" <<<"$result")
text=$(jq -r '.text // ""' <<<"$result")
note=$(jq -r '.note // ""' <<<"$result")

if [ "$event" = Stop ]; then
  pending=$(jq -r '.pending // ""' <<<"$result")
  [ "$(jq -r '.interrupt // false' <<<"$result")" = true ] || [ -n "$pending" ] || exit 0
  jq -r '.hold[]?' <<<"$result" >>"$HELD"
  jq -n --arg r "$(printf '%s\n\n%s' "$text" "$pending" | sed '/./,$!d')" --arg m "$(jq -r '.stopnote // ""' <<<"$result")" \
    '{decision: "block", reason: $r, systemMessage: "CaptainMorgue:\n\($m)"}'
else
  context=$(printf '%s\n\n%s' "$brief" "$text" | sed '/./,$!d')
  [ -n "${context//[[:space:]]/}" ] && jq -n --arg e "$event" --arg c "$context" --arg m "$note" \
    '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}} + (if $m != "" then {systemMessage: "CaptainMorgue:\n\($m)"} else {} end)'
fi
[ "$upto" -gt "$seen" ] && ack "$upto"
exit 0
