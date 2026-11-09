# 3. Broadcast to everyone and to a team

Everyone has joined (runbook 1).

1. **Emmanuel**: `/captainmorgue:broadcast root Freeze deploys to checkin until 17:00`
   - Emmanuel sees `Sent broadcast (seq N) to jubril, sammy. Why: everyone who joined INC-1`.
   - **Sammy and Jubril**: type any prompt. Claude shows `[broadcast] ... from tiemma: Freeze deploys to checkin until 17:00`.
   - Wall screen: the message panel shows the broadcast and who it went to.

2. **Jubril**: `/captainmorgue:broadcast @platform Hall B kiosks are back`
   - **Emmanuel and Sammy**: type any prompt. Both see the message from jubril.
   - Jubril sees `Sent broadcast (seq N) to sammy, tiemma. Why: Platform members who joined INC-1`; the sender never gets their own message.

3. **Sammy**: `/captainmorgue:broadcast Checking spans on my side` (no target: goes to Sammy's own team, platform)
   - **Emmanuel**: sees it on the next prompt.
   - **Jubril**: types a prompt and sees nothing new; `/captainmorgue:inbox` says `No unread messages.`
