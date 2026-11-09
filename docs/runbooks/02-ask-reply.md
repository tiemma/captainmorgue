# 2. Ask a person and reply

Everyone has joined (runbook 1).

1. **Jubril**: `/captainmorgue:ask @sammy Is otel-collector dropping spans?`
   - Jubril sees `Sent ask (seq N) to sammy`.
   - Sammy's laptop raises a desktop notification within a few seconds.

2. **Sammy**: type any prompt (for example `what's new?`).
   - Claude shows the ask verbatim: from jubril, the text, and asks how to answer.
   - Wall screen: the ask goes from delivered to seen.

3. **Sammy**: tell Claude the answer, for example `say: no drops, queue is at 2%`. Approve the reply it proposes.
   - Claude runs `/captainmorgue:reply N no drops, queue is at 2%` and shows `Sent reply`.

4. **Jubril**: type any prompt.
   - Claude shows `[reply] ... from sammy: no drops, queue is at 2%`.

5. **Emmanuel**: `/captainmorgue:status @sammy` lists the reply among Sammy's latest events.
