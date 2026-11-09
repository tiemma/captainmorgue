# 5. Laptop goes silent: suspect, offline, election

Everyone has joined (runbook 1). Emmanuel manages platform (term 1), Sammy is the other platform member.

Timings on the live service: no heartbeat for 15 s -> suspect, 30 s -> offline, then CaptainMorgue starts an election.

1. **Emmanuel**: stop the poller to simulate a closed laptop (closing the lid works too):

   ```
   kill "$(cat ~/.captainmorgue/poll.pid)"
   ```

   Note the time.

2. **Everyone** watches the wall screen:
   - about 15 s: tiemma turns amber, `suspect`.
   - about 30 s: tiemma turns grey, `offline`.
   - right after: Sammy's poller answers the vote request by itself; an `election` event and banner read `Platform elected sammy, term 2, 2 of 2 (captainmorgue, sammy)`. Platform shows `term 2`, `MGR` moves to sammy.

3. **Sammy**: type any prompt, then `/captainmorgue:status platform`.
   - Claude shows the `[election]` message.
   - Status shows `Team platform, manager sammy:` and sammy as `responder, team manager`.

4. **Jubril**: `/captainmorgue:status platform` shows `manager sammy`, tiemma `offline`.

5. **Emmanuel** comes back: `/captainmorgue:join platform commander Watching confdb failover`
   - Emmanuel sees `manager sammy, term 2` and `Commander: tiemma.` (still the commander; managing a team and commanding the incident are separate).
   - Wall screen: tiemma back online as a member, sammy keeps `MGR`.
