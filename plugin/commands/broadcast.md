---
description: Broadcast to your team, another team (@team) or everyone (root)
argument-hint: [@team|root] <message>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" broadcast <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Tell the user, in one line, the result above. Do nothing else.
