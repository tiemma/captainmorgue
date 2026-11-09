# 1. Join with role and team, and see each other

Prerequisite: the plugin is installed (AGENTS.md, milestone steps 1 and 2) and the service runs a build with roles.

1. **Everyone**, in the shell you start Claude Code from:

   ```
   export CM_URL=https://captainmorgue.cnh.radarhq.io CM_TOKEN=<team token from Emmanuel>
   export CM_ACTOR=<your login> CM_TEAM=<your team> CM_ROLE=<your role>
   export CM_REPO=captainmorgue CM_TOOLS='kubectl, radar, gh'
   ```

   Then restart Claude Code.

2. **Emmanuel first**, then Sammy, then Jubril (order matters: the first on a team manages it):

   | Who | Command |
   |---|---|
   | Emmanuel | `/captainmorgue:join platform commander Watching confdb failover` |
   | Sammy | `/captainmorgue:join platform responder Checking otel-collector` |
   | Jubril | `/captainmorgue:join registration scribe Writing the timeline` |

   - Emmanuel sees `role commander, manager tiemma, term 1` and `Commander: tiemma.`
   - Sammy sees `manager tiemma` and `Commander: tiemma.`
   - Jubril sees `manager jubril, term 1` (first on registration).

3. **Sammy** tries to take command: `/captainmorgue:join platform commander Checking otel-collector`.
   - Sammy sees `Commander is already tiemma; you joined as responder.`
   - Sammy rejoins as before: `/captainmorgue:join platform responder Checking otel-collector`.

4. **Everyone**: `/captainmorgue:status`.
   - The first line ends with `commander tiemma`.
   - `You:` shows your role, task, repo and tools. Emmanuel's also says `team manager`.
   - Emmanuel and Sammy see each other under `Team:` with role and `working on:`.

5. **Jubril**: `/captainmorgue:status @tiemma`, then `/captainmorgue:status platform`.
   - `- tiemma (online, team platform, commander, team manager)`, `working on: Watching confdb failover`, `repo: captainmorgue; tools: kubectl, radar, gh`.
   - The team view lists tiemma and sammy the same way.

6. **Sammy** changes task: `/captainmorgue:task Restarting otel-collector`.
   - Sammy sees `Working on: Restarting otel-collector`.
   - **Emmanuel**: `/captainmorgue:status @sammy` shows the new task and a `Working on:` event.

7. **Wall screen**: three people under their teams, online, `MGR` on tiemma and jubril, `COMMANDER` on tiemma, `SCRIBE` on jubril, each with their task in grey. Hover a person for repo and tools.
