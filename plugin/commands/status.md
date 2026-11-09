---
description: Show your incident status, or a teammate's or team's status and latest events
argument-hint: [@person|team]
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" status <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else.
