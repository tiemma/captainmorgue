# 6. Two people act on the same resource: conflict interrupt

Everyone has joined (runbook 1). Never break the cluster on purpose: this runbook feeds the plugin's hook a tool call by hand, so nothing runs against Kubernetes.

Both people run this from a checkout of `tiemma/captainmorgue`, in a shell with their `CM_*` variables set (runbook 1, step 1). A conflict needs two different people, the same resource, at least one write, within 2 minutes.

1. **Sammy**: report a restart of the checkin deployment:

   ```
   echo '{"hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"kubectl -n team-captainmorgue rollout restart deploy/checkin"}}' | plugin/hooks/send.sh
   ```

   - Wall screen: an action from sammy, `Bash: kubectl -n team-captainmorgue rollout restart deploy/checkin (ok)`.

2. **Jubril**, within 2 minutes, reports the same restart:

   ```
   echo '{"hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"kubectl -n team-captainmorgue rollout restart deploy/checkin"}}' | plugin/hooks/send.sh
   ```

3. **Sammy and Jubril** get a desktop notification. On the next prompt Claude shows:
   - `[conflict] ... from captainmorgue: jubril is acting on Deployment/checkin while sammy's "Bash: kubectl -n team-captainmorgue rollout restart deploy/checkin (ok)" is still in effect. Check with each other before going on.`
   - Claude says to stop risky work on checkin until they decide, and does not end its turn while the conflict is unread.

4. **Wall screen**: the conflict panel names both people and the resource. When the service runs with Claude, it may reword the why, or drop the conflict if it judges the two actions compatible; identical restarts are kept.

5. **Emmanuel**: `/captainmorgue:status @jubril` lists the conflict-causing action among Jubril's latest events.
