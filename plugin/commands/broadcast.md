---
description: Broadcast a message to the people working the incident
argument-hint: <message>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/hooks/send.sh:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/hooks/send.sh" broadcast <<'CM_BROADCAST_END'
$ARGUMENTS
CM_BROADCAST_END
```

Tell the user, in one line, the result above. Do nothing else.
