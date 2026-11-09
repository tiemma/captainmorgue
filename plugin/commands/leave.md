---
description: Leave the incident and stop the poller
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" leave <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Tell the user, in one line, the result above. Do nothing else.
