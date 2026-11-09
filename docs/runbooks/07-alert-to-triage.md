# 7. From a real alert to a closed incident

The demo, end to end. A fault is injected into the conference app, Dash0 sees it, and its alert opens the incident in CaptainMorgue, which pages the team that owns the service and coordinates the three of us until it is fixed and recorded.

Everyone has joined (runbook 1) in this order, so Emmanuel manages Platform and Jubril manages Registration:

| Person | `CM_ACTOR` | Team | Role |
|---|---|---|---|
| Emmanuel | `tiemma` | platform | commander |
| Sammy | `sammy` | platform | responder |
| Jubril | `jubril` | registration | scribe |

The walkthrough uses a fault on `confdb` (owned by Platform). For a fault on `checkin` or `kiosk`, swap the service and the paged person is Jubril.

## Once, before the rehearsal: point Dash0 at CaptainMorgue

1. In Dash0, add a notification channel of type **Webhook**:
   - URL: `https://captainmorgue.cnh.radarhq.io/alerts`
   - Additional HTTP header: `Authorization: Bearer <team token>`
2. Attach the channel to the check rules for the conference services (error rate and latency). The alert must carry the service in a `service.name` label (an `impacted_service` or `service` label or annotation also works) whose value is a service from `roster.yaml`: `checkin`, `kiosk`, `confdb`, `otel-collector` or `captainmorgue`.
3. The fallback, when Dash0 is slow or the rule has not fired: anyone runs
   ```
   CM_URL=https://captainmorgue.cnh.radarhq.io CM_TOKEN=<team token> scripts/trigger.sh confdb 'confdb p99 latency above 2s'
   ```
   It posts the same alert as Dash0 would, with `trigger` as the source.

## The run

1. **Fault injected** into `confdb` (cluster repo flow). Nobody touches CaptainMorgue yet.

2. **Alert.** Within the check rule's interval Dash0 fires `alert.ongoing` for `confdb`.
   - Wall screen: the incident title becomes `INC-1: confdb: <alert summary>`, status open; the Signals panel shows `confdb` in red with the summary; the feed shows `Opened`, `Alert` and `Paged`.
   - Sammy and Jubril get a notification and, on their next prompt, `[alert] ... confdb alert: <summary>. Platform owns it; tiemma is paged.`

3. **Page.** Emmanuel's laptop raises the alert dialog. On his next prompt Claude stops, shows the page verbatim and asks with AskUserQuestion: **I will take it**, **Hand off to someone**, **Let my agent investigate**.
   - Emmanuel picks **Hand off to someone**, names `@sammy`. Claude runs `/captainmorgue:ask @sammy Can you take the confdb alert? ...` and sets his task to `Handed confdb alert to @sammy`.
   - Repeated Dash0 notifications for confdb in the next 10 minutes only update the signal; nobody is paged again.

4. **Claims.** Sammy answers the ask with **I am on it**, then tells Claude to investigate. Claude runs `/captainmorgue:task Agent investigating confdb` and a subagent reads confdb with the Radar MCP (pods, events, recent changes, logs) and the Dash0 MCP (error rate, latency, failing traces), then reports the likely cause and a proposed fix.
   - Sammy approves the fix. The first write against the confdb resource claims it: the wall screen's Claims panel shows `sammy` on it.

5. **Asks across teams.** Jubril, as scribe, sees check-in slowing at the venue and asks: `/captainmorgue:ask @sammy Is confdb why check-in is slow?` Sammy replies `yes, fix rolling out`. Jubril broadcasts to Registration: `/captainmorgue:broadcast @registration check-in recovering in a few minutes, confdb fix rolling out`.
   - If Emmanuel tries the same write on confdb while Sammy holds it, the hook denies it and names Sammy (runbook 6).

6. **Fix.** Sammy's change lands (reverting the injected fault). Sammy broadcasts the one-line finding: `/captainmorgue:broadcast root confdb fixed: <cause>`.

7. **Recovered.** Dash0 sends `alert.resolved` (fallback: `scripts/trigger.sh confdb 'confdb latency back to normal' resolved`).
   - Wall screen: the confdb signal turns green with `recovered`; everyone gets `[recovered] ... confdb recovered: ...`. Claude suggests to Emmanuel, as commander, that the incident can be closed.

8. **Close.** Emmanuel closes it:
   ```
   curl -sS -X POST -H "Authorization: Bearer $CM_TOKEN" -H 'Content-Type: application/json' \
     "$CM_URL/events" -d '{"actor":"tiemma","type":"close","text":"confdb fixed and recovered"}'
   ```
   - Wall screen: status Resolved with the time.

9. **Record.** The wall screen switches to the record: who joined, the teams pulled in, the asks and the claim, the fix and the time to resolve. `curl $CM_URL/record/INC-1` returns the same. The next alert after a close opens the incident again with a new title.
