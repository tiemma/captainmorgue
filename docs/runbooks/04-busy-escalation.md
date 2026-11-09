# 4. Busy person: auto-reply after 60 s, then escalation

Everyone has joined (runbook 1). Emmanuel manages platform, Sammy is a member of it.

"Busy" means Sammy's Claude Code does not read the ask: no prompts, no running tool calls, no `/captainmorgue:inbox` for 60 s. The poller keeps running, so Sammy stays online.

1. **Sammy**: stop typing in Claude Code and wait. Ignore the desktop notification.

2. **Jubril**: `/captainmorgue:ask @sammy Can you confirm confdb replica lag?` and note the time.
   - Wall screen: the ask shows delivered, not seen.

3. **Wait 60 s.** Nobody touches Sammy's session.

4. **Jubril**: type any prompt.
   - Claude shows `[autoreply] ... from captainmorgue: sammy has not seen your ask yet. Latest from sammy at HH:MM:SS: ...` with Sammy's last event (for example the task from runbook 1).

5. **Emmanuel**: type any prompt (a desktop notification arrives first).
   - Claude shows `[escalation] ... from captainmorgue: sammy has not seen jubril's ask for 1m0s: "Can you confirm confdb replica lag?"` with why `You manage sammy, who has not answered.`
   - Wall screen: the autoreply and escalation appear in the timeline.

6. **Sammy**: type any prompt. The ask now shows, late; reply with `/captainmorgue:reply N <text>` so Jubril gets an answer.
