---
description: Show unread CaptainMorgue messages and mark them seen
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" inbox <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else. Then handle any ask or conflict as the messages instruct.
