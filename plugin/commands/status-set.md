---
description: Move the incident through open, investigating, mitigated, resolved, closed, or set its severity
argument-hint: <investigating|mitigated|resolved|closed|sev1|sev2|sev3> [why]
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" status-set <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

Show the user the output above as is. Do nothing else.
