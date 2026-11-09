---
description: Reply to an ask by its seq, after the user approved the text
argument-hint: <seq> <text>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" reply <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Tell the user, in one line, the result above. Do nothing else.
