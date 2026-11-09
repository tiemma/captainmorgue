---
description: Open a pull request against the repository of an affected service, linked to the incident
argument-hint: <service> <what to change>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/cm:*), Bash(git:*), Bash(gh pr create:*), Bash(gh repo clone:*)
---

```!
"${CLAUDE_PLUGIN_ROOT}/bin/cm" fix <<'CM_ARGS_END'
$ARGUMENTS
CM_ARGS_END
```

If the output above says a pull request is already open, or names no repository, show it to the user as is and stop.

Otherwise follow its steps: make the change on that branch, open the pull request with `gh pr create` exactly as described, never merge it, then run the `cm pr` command it gives with the pull request URL. Tell the user the URL.
