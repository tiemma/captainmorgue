# Runbooks: test messaging for real

Three people, each in their own Claude Code session, against https://captainmorgue.cnh.radarhq.io. Run them in order; each takes a few minutes. Keep the wall screen open on a shared display: https://captainmorgue.cnh.radarhq.io.

| Person | `CM_ACTOR` | Team | Role |
|---|---|---|---|
| Emmanuel | `tiemma` | platform (owns confdb, otel-collector, captainmorgue) | commander |
| Sammy | Sammy's GitHub login, written `sammy` below | platform | responder |
| Jubril | Jubril's GitHub login, written `jubril` below | registration (owns checkin, kiosk) | scribe |

Replace `sammy` and `jubril` with the real logins in every command.

1. [Join and see each other](01-join.md)
2. [Ask a person and reply](02-ask-reply.md)
3. [Broadcast to everyone and to a team](03-broadcast.md)
4. [Busy person: auto-reply and escalation](04-busy-escalation.md)
5. [Laptop goes silent: suspect, offline, election](05-silent-election.md)
6. [Two people on one resource: conflict](06-conflict.md)

A service restart clears the incident. If someone's commands say "join first", rerun step 2 of runbook 1 for them.
