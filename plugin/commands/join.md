---
description: Join the incident with your team, role and task, start the heartbeat and inbox poller
argument-hint: [team] [commander|responder|scribe] [task]
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" join <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else.
