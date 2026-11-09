---
description: Approve a teammate's destructive action by its approval id
argument-hint: <id>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" approve <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Tell the user, in one line, the result above. Do nothing else.
