---
description: Declare an incident; CaptainMorgue opens it and pages the team that owns the service
argument-hint: <service> <what is wrong>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" open <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else.
