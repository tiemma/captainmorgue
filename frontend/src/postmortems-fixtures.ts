import type { PostmortemDocument } from "./postmortems";

export const SAMPLE_POSTMORTEMS: PostmortemDocument[] = [
  {
    id: "SAMPLE-2041",
    title: "Check-in lookup exhausted the shared database pool",
    summary:
      "A badge-email lookup introduced in checkin v1.8 scanned every attendee row. Slow queries occupied the confdb connection pool and left Hall B kiosks waiting for check-in responses. Registration and Platform coordinated a canary abort, preserved the database primary, and verified kiosk recovery before closing.",
    opened: "2026-11-09T14:41:00Z",
    resolved: "2026-11-09T14:58:00Z",
    fixed_by: "Emmanuel and Sammy",
    status: "resolved",
    commands: [
      { seq: 3, ts: "2026-11-09T14:42:10Z", actor: "emmanuel", team: "registration", tool: "Bash", command: "kubectl get pods -n conference -l app=checkin", outcome: "ok", changed: false, led_to_resolution: false },
      { seq: 4, ts: "2026-11-09T14:42:40Z", actor: "sammy", team: "platform", tool: "Bash", command: "kubectl exec confdb-0 -n conference -- psql -c 'select count(*) from pg_stat_activity'", outcome: "ok", changed: true, led_to_resolution: false },
      { seq: 6, ts: "2026-11-09T14:44:05Z", actor: "sammy", team: "platform", tool: "Bash", command: "kubectl rollout restart statefulset/confdb -n conference", outcome: "failed", changed: true, led_to_resolution: false, resource: { kind: "StatefulSet", namespace: "conference", name: "confdb" }, exit_code: 1 },
      { seq: 8, ts: "2026-11-09T14:45:30Z", actor: "emmanuel", team: "registration", tool: "Bash", command: "kubectl rollout undo deployment/checkin -n conference", outcome: "ok", changed: true, led_to_resolution: true, resource: { kind: "Deployment", namespace: "conference", name: "checkin" }, exit_code: 0 },
      { seq: 10, ts: "2026-11-09T14:49:12Z", actor: "emmanuel", team: "registration", tool: "Bash", command: "kubectl rollout status deployment/checkin -n conference", outcome: "ok", changed: false, led_to_resolution: false },
      { seq: 11, ts: "2026-11-09T14:53:40Z", actor: "emmanuel", team: "registration", tool: "Bash", command: "psql -c 'create index concurrently attendees_badge_email on attendees (badge_email)'", outcome: "ok", changed: true, led_to_resolution: true, exit_code: 0 },
    ],
    steps: [
      { seq: 1, ts: "2026-11-09T14:41:00Z", actor: "dash0", team: "registration", kind: "detected", text: "Check-in p95 above 4 s at Hall B kiosks" },
      { seq: 4, ts: "2026-11-09T14:42:40Z", actor: "sammy", team: "platform", kind: "changed", text: "Bash: psql connection count (ok)", command: "kubectl exec confdb-0 -n conference -- psql -c 'select count(*) from pg_stat_activity'", outcome: "ok" },
      { seq: 5, ts: "2026-11-09T14:43:20Z", actor: "emmanuel", team: "registration", kind: "investigated", text: "Badge-email lookup in v1.8 scans every attendee row" },
      { seq: 6, ts: "2026-11-09T14:44:05Z", actor: "sammy", team: "platform", kind: "changed", text: "Bash: restart confdb (failed)", command: "kubectl rollout restart statefulset/confdb -n conference", outcome: "failed" },
      { seq: 7, ts: "2026-11-09T14:44:30Z", actor: "captainmorgue", team: "platform", kind: "conflict", text: "Restart could interrupt the canary rollback on confdb" },
      { seq: 8, ts: "2026-11-09T14:45:30Z", actor: "emmanuel", team: "registration", kind: "changed", text: "Bash: rollback checkin (ok)", command: "kubectl rollout undo deployment/checkin -n conference", outcome: "ok" },
      { seq: 9, ts: "2026-11-09T14:46:10Z", actor: "sammy", team: "platform", kind: "decided", text: "Hold the confdb restart while connections drain" },
      { seq: 11, ts: "2026-11-09T14:53:40Z", actor: "emmanuel", team: "registration", kind: "changed", text: "Bash: add index (ok)", command: "psql -c 'create index concurrently attendees_badge_email on attendees (badge_email)'", outcome: "ok" },
      { seq: 12, ts: "2026-11-09T14:58:00Z", actor: "emmanuel", team: "registration", kind: "resolved", text: "Recovery verified and incident closed" },
    ],
    parts: [
      {
        name: "Restore check-in responses",
        resolution:
          "Emmanuel aborted the v1.8 canary and restored v1.7. Registration verified an attendee check-in at the Hall B kiosk after latency returned to its normal range.",
      },
      {
        name: "Drain confdb connections safely",
        resolution:
          "Sammy held the proposed primary restart while the canary drained. Active connections fell from 96 to 41 without interrupting in-flight check-ins.",
      },
      {
        name: "Correct the attendee lookup",
        resolution:
          "Registration added an index on attendees.badge_email, checked the query plan, and validated the corrected lookup before preparing the next release.",
      },
    ],
    improvements: [
      {
        text: "Check query plans for new attendee lookups before release.",
        owner: "Registration",
      },
      {
        text: "Alert on sustained confdb connection pool saturation.",
        owner: "Platform",
      },
      {
        text: "Include a physical kiosk check in the recovery checklist.",
        owner: "Registration",
      },
    ],
    events: [
      {
        time: "14:41",
        title: "Check-in latency alert opened the incident",
        detail:
          "Hall B kiosks were waiting more than four seconds for attendee lookups.",
      },
      {
        time: "14:44",
        title: "Canary rollback and database restart conflicted",
        detail:
          "The crew agreed to keep the primary running while the rollback drained connections.",
      },
      {
        time: "14:46",
        title: "Investigation identified the missing index",
        detail: "The badge-email query scanned 48,000 attendee rows.",
      },
      {
        time: "14:58",
        title: "Recovery verified and incident closed",
        detail:
          "Registration completed a kiosk check and Platform confirmed the pool had recovered.",
      },
    ],
  },
  {
    id: "SAMPLE-2038",
    title: "Hall A kiosks retained an outdated check-in endpoint",
    summary:
      "A kiosk configuration update left a subset of Hall A devices pointing at the previous check-in endpoint. Registration isolated the affected devices, refreshed their configuration, and confirmed that new check-ins reached the active service. The checkin service and confdb remained healthy throughout.",
    opened: "2026-11-08T09:12:00Z",
    resolved: "2026-11-08T09:31:00Z",
    fixed_by: "Emmanuel",
    parts: [
      {
        name: "Identify affected kiosks",
        resolution:
          "Registration compared device configuration revisions and isolated the Hall A kiosks still using the old endpoint.",
      },
      {
        name: "Refresh kiosk configuration",
        resolution:
          "The crew refreshed the affected configuration and verified one complete attendee check-in on each device before returning it to service.",
      },
    ],
    improvements: [
      {
        text: "Display the active endpoint and configuration revision in kiosk diagnostics.",
        owner: "Registration",
      },
      {
        text: "Validate endpoint reachability before accepting a kiosk configuration update.",
        owner: "Registration",
      },
    ],
    events: [
      {
        time: "09:12",
        title: "Hall A reported check-in failures",
        detail: "Other halls continued checking attendees in normally.",
      },
      {
        time: "09:20",
        title: "Outdated endpoint isolated",
        detail:
          "Affected devices shared the same previous configuration revision.",
      },
      {
        time: "09:31",
        title: "Every affected device verified",
        detail:
          "Each kiosk completed a test check-in after refreshing configuration.",
      },
    ],
  },
  {
    id: "SAMPLE-2029",
    title: "Confdb connections remained open after an attendee import",
    summary:
      "An attendee import left idle transactions open in confdb. The shared connection pool approached capacity as checkin traffic increased. Platform identified the import sessions, coordinated their cleanup with Registration, and verified that normal check-in requests could acquire connections again.",
    opened: "2026-11-07T16:04:00Z",
    resolved: "2026-11-07T16:28:00Z",
    fixed_by: "Sammy",
    parts: [
      {
        name: "Identify idle import sessions",
        resolution:
          "Platform inspected session age and transaction state to distinguish the abandoned import sessions from active check-in traffic.",
      },
      {
        name: "Release connections and verify check-in",
        resolution:
          "After Registration confirmed the import had finished, Platform cleared its idle sessions. The pool recovered and the crew verified a normal attendee lookup.",
      },
    ],
    improvements: [
      {
        text: "Close import transactions in the worker cleanup path.",
        owner: "Registration",
      },
      {
        text: "Set an idle transaction timeout for the import connection role.",
        owner: "Platform",
      },
    ],
    events: [
      {
        time: "16:04",
        title: "Connection pressure increased",
        detail:
          "The checkin service began waiting for available database connections.",
      },
      {
        time: "16:15",
        title: "Idle import transactions identified",
        detail:
          "Session activity matched an attendee import that had already finished.",
      },
      {
        time: "16:28",
        title: "Database capacity restored",
        detail:
          "No active attendee check-in session was interrupted during cleanup.",
      },
    ],
  },
];
