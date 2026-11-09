---
description: Add an action item with an owner to the incident record
argument-hint: @owner <follow-up>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" action <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else.
