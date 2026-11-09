# 9. Destructive action: manager approval

Everyone has joined (runbook 1), Emmanuel first, so he manages platform and is the commander. Never break the cluster on purpose: this runbook feeds the plugin's hook a tool call by hand, so nothing runs against Kubernetes.

Destructive means `kubectl delete`, `kubectl scale ... --replicas=0`, `kubectl rollout restart|undo`, `kubectl drain`, `kubectl argo rollouts undo`, `helm uninstall|delete`, and Radar `delete_resource` (not a dry run) or `manage_*` with `restart`, `delete`, `uninstall`, `drain`, or `scale` to 0. Set `CM_APPROVALS=off` to switch the gate off.

The approver is the requester's team manager, or the commander when the requester is the manager. The commander may also decide any approval. A request expires after 5 minutes; an approval lets the same action through for 10 minutes.

1. **Sammy**: feed the hook a delete:

   ```
   echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"kubectl -n team-captainmorgue delete pod confdb-0"}}' | plugin/hooks/approve.sh
   ```

   - Output: a `deny` whose reason says to run `.../plugin/bin/cm approve-request "kubectl delete pod confdb-0 -n team-captainmorgue" "<why it is needed>"`. In a real session Claude reads this and runs it.

2. **Sammy**: request it:

   ```
   plugin/bin/cm approve-request "kubectl delete pod confdb-0 -n team-captainmorgue" "confdb-0 is wedged on a stale lock"
   ```

   - Output: `Approval 1 requested from tiemma ...`.
   - Wall screen: the Approvals panel shows #1 pending, waiting on tiemma.

3. **Emmanuel** gets a desktop notification. On the next prompt Claude shows `[approval_request] ... from sammy: Approval 1: ...` and asks him to Approve or Deny.

4. **Jubril**: try to approve it: `plugin/bin/cm approve 1`.
   - Output: `Not decided: only tiemma or the commander can decide approval 1`.

5. **Emmanuel**: `/captainmorgue:approve 1` (or press Approve on the wall screen after joining there as tiemma, or type `approve 1` in the console pane).
   - Sammy's next prompt shows `[approval] ... tiemma approved approval 1 ...`.

6. **Sammy**: rerun step 1. No output: the call is allowed.

7. **Jubril** (manager of registration, so the commander approves): run step 1 with `kubectl -n team-captainmorgue scale deploy/checkin --replicas=0`, then `plugin/bin/cm approve-request "kubectl scale deploy/checkin -n team-captainmorgue" "drain check-in"`.

8. **Emmanuel**: `/captainmorgue:deny 2 not during check-in`.
   - Jubril's next prompt shows the denial; rerunning the hook still denies.
   - Wall screen: #2 denied by tiemma with the reason.

9. **Anyone**: `plugin/bin/cm approvals` lists both. After close, the RFO counts held approvals under what went well and lists the denial under errors.
