# Project plugin setup

The repository declares the CaptainMorgue marketplace and enables its plugin in `.claude/settings.json`. The existing team-context and ledger hooks remain in place. The marketplace points at `tiemma/captainmorgue`; its plugin entry loads `./plugin` from that marketplace checkout.

Claude Code applies repository marketplaces after the user trusts the folder. Review the repository, open an interactive Claude Code session in it, accept its trust prompt, and restart the session after setup. Check `/plugin` for `captainmorgue@captainmorgue` before using its commands. A committed setting does not prove the plugin loaded in any particular running session. See the official [repository plugin setup](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository) and [settings reference](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces).

If the marketplace or plugin is missing, run these from the repository directory:

```bash
claude plugin marketplace add tiemma/captainmorgue
claude plugin install captainmorgue@captainmorgue --scope project
```

Restart Claude Code and check `/plugin` again. For an existing installation that needs Emmanuel's latest release:

```bash
claude plugin marketplace update captainmorgue
claude plugin update captainmorgue@captainmorgue
```

Restart after updating. Keep credentials in your own shell profile or local environment. Follow [the agent milestone](../AGENTS.md#milestone-set-it-up-on-your-own-agent) for identity, MCP authentication, doctor, join and the real ask/reply check. The first doctor run may report that the poller has not started; join and rerun doctor. Do not tick the milestone merely because the config is committed.

This setup targets interactive local Claude Code. It does not bypass workspace trust, register a person's identity, authenticate MCP servers, or install Claude plugins into Codex. Codex repository coordination is documented separately in [codex-hooks.md](codex-hooks.md).

## Other repositories

For `tiemma/captainmorgue-cluster`, first read its own `AGENTS.md`, then merge these keys into its `.claude/settings.json`, preserving all existing hooks and settings:

```json
{
  "extraKnownMarketplaces": {
    "captainmorgue": {
      "source": {
        "source": "github",
        "repo": "tiemma/captainmorgue"
      }
    }
  },
  "enabledPlugins": {
    "captainmorgue@captainmorgue": true
  }
}
```

The marketplace source remains `tiemma/captainmorgue`, even in the cluster repository. That repository needs its own trust and runtime check. Its configuration is a separate handoff; this change only configures the application repository.

## Validation

The fresh worktree was checked with JSON parsing, marketplace/plugin name agreement, unchanged hook configuration, and `claude plugin validate` for the repository and `plugin/`. These checks validate the artifacts; they do not establish a trusted, authenticated Claude Code session or complete the live milestone.
