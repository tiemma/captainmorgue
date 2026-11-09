# 8. Run the incident to the end: status, notes, action items, fix PR, close and RFO

Everyone has joined (runbook 1). Emmanuel is commander. Keep the wall screen open.

1. **Jubril**: `/captainmorgue:status-set investigating checkin slow at Hall B`, then `/captainmorgue:status-set sev2`.
   - Output: `INC-1 is investigating, sev2.` The wall header pill reads `investigating sev2`.
2. **Sammy**: record evidence as it arrives, for example a Radar investigation or a Dash0 query:
   `/captainmorgue:note Radar investigation: checkin pods OOMKilled since the 2.3 release`
3. **Sammy**: `/captainmorgue:fix checkin raise the memory limit to 512Mi`
   - Claude opens a pull request on `fix/inc-1-checkin` in `tiemma/captainmorgue-cluster` with `gh pr create`, its body linking the incident and the note, then runs `cm pr <url> checkin`.
   - The wall's Pull requests panel lists it. Nobody merges it from here; Gitar reviews it.
4. **Jubril**: `/captainmorgue:fix checkin anything` answers that a pull request is already open and names it. No second pull request.
5. **Jubril**: `/captainmorgue:status-set mitigated rolled back checkin`. Then `/captainmorgue:status-set resolved`: refused, `only the commander, or a team manager when there is no commander, can move INC-1 to resolved`.
6. **Emmanuel**: `/captainmorgue:action @jubril Add a memory alert on checkin`, then `/captainmorgue:status-set resolved`, then `/captainmorgue:close Rolled back checkin and raised its memory limit`.
   - Output: `INC-1 is closed.` and the RFO link `/record/INC-1.md`.
7. **Jubril**: on the next prompt Claude shows `[action] ... Action items for you from the INC-1 RFO: - Add a memory alert on checkin (due within 1 week)`. `/captainmorgue:status` lists the action items.
8. **Wall screen**: the Record tab shows the RFO: severity, detected, mitigated, resolved, time to mitigate, summary, root cause, timeline, errors, action items, remediation, what went well and badly, and a link to the Markdown.
9. **Anyone**: open https://captainmorgue.cnh.radarhq.io/record/INC-1.md for the RFO as Markdown.

Without `ANTHROPIC_API_KEY` the service writes every section from the events (`written_by: captainmorgue`). With it, Claude writes the narrative (`written_by: claude`) and the window, timeline, errors, remediation and your action items stay as recorded.
