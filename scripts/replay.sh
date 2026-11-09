#!/usr/bin/env bash
set -euo pipefail

: "${CM_URL:?set CM_URL, for example http://localhost:8080}"
DELAY="${DELAY:-1}"

while IFS= read -r line; do
  [ -z "$line" ] && continue
  if jq -e 'has("from")' >/dev/null <<<"$line"; then
    path=/broadcast
  else
    path=/events
  fi
  curl -sS -f --max-time 5 -H 'Content-Type: application/json' -d "$line" "${CM_URL%/}$path" >/dev/null
  echo "$path $(jq -r '(.actor // .from) + " " + (.type // "broadcast") + ": " + .text' <<<"$line")"
  sleep "$DELAY"
done <<'EOF'
{"incident_id":"INC-1","actor":"dash0","type":"alert","text":"Check-in p95 latency 4.2 s and 18% errors on checkin. Kiosk queue at Hall B growing.","artifacts":[{"label":"Dash0: checkin latency"}]}
{"incident_id":"INC-1","actor":"captainmorgue","type":"action","text":"Opened INC-1. Affected: checkin, which uses confdb."}
{"incident_id":"INC-1","actor":"captainmorgue","type":"action","text":"This looks like INC-1877 from last year's event: slow check-in query after a release. Fixed by an index, by Priya on Registration.","artifacts":[{"label":"INC-1877 record"}]}
{"incident_id":"INC-1","actor":"captainmorgue","type":"join","text":"Pulled in Registration (team label on checkin) and Platform (owns confdb in CODEOWNERS)."}
{"incident_id":"INC-1","actor":"dana","type":"join","text":"Joined as manager of Registration."}
{"incident_id":"INC-1","actor":"ben","type":"join","text":"Joined as manager of Platform."}
{"incident_id":"INC-1","actor":"ana","type":"action","text":"Checked the checkin rollout through Radar: canary of v1.8 at 20% since 09:38.","artifacts":[{"label":"Radar: rollout checkin"}]}
{"incident_id":"INC-1","actor":"dev","type":"action","text":"confdb has 96 of 100 connections busy, most of them held by checkin for about 3 s each.","artifacts":[{"label":"Dash0: confdb connections"}]}
{"incident_id":"INC-1","actor":"dash0","type":"alert","text":"Payment errors at 9% on payments. Card payments failing at the merch stand.","artifacts":[{"label":"Dash0: payments errors"}]}
{"incident_id":"INC-1","actor":"captainmorgue","type":"join","text":"Pulled in Ticketing and Payments: payments shares confdb with checkin."}
{"incident_id":"INC-1","actor":"eli","type":"join","text":"Joined as manager of Ticketing and Payments."}
{"incident_id":"INC-1","from":"gus","text":"Is confdb failing over? Card payments are timing out at the merch stand."}
{"incident_id":"INC-1","actor":"dana","type":"decision","text":"Abort the checkin canary and go back to v1.7.","resource":{"kind":"Rollout","namespace":"team-captainmorgue","name":"checkin"},"artifacts":[{"label":"Radar: abort rollout"}]}
{"incident_id":"INC-1","actor":"dev","type":"action","text":"Restart the checkin rollout to drop its confdb connections.","resource":{"kind":"Rollout","namespace":"team-captainmorgue","name":"checkin"}}
{"incident_id":"INC-1","actor":"dev","type":"action","text":"Holding the checkin restart."}
{"incident_id":"INC-1","actor":"argo","type":"ship","text":"Rollout checkin aborted. v1.7 serving 100%.","artifacts":[{"label":"Radar: rollout checkin"}]}
{"incident_id":"INC-1","actor":"captainmorgue","type":"investigation","text":"Started a Radar AI investigation on deployment/checkin.","artifacts":[{"label":"Radar investigation"}]}
{"incident_id":"INC-1","actor":"radar","type":"investigation","text":"Finding: v1.8 looks attendees up by badge email with no index. Every check-in scans 48k rows and holds a confdb connection for about 3 s.","artifacts":[{"label":"Radar investigation"},{"label":"query plan"}]}
{"incident_id":"INC-1","actor":"dash0","type":"signal","text":"Payment errors at 0.3%. confdb at 41 of 100 connections."}
{"incident_id":"INC-1","actor":"cal","type":"action","text":"Opened PR #212: add an index on attendees(badge_email) and ship it as v1.8.1.","artifacts":[{"label":"PR #212"}]}
{"incident_id":"INC-1","actor":"gitar","type":"ship","text":"PR #212: no critical findings. One flaky test retried, CI green.","artifacts":[{"label":"PR #212 checks"}]}
{"incident_id":"INC-1","actor":"argo","type":"ship","text":"Synced checkin v1.8.1 as a canary through Radar. Canary healthy, promoted.","artifacts":[{"label":"Radar: rollout checkin"}]}
{"incident_id":"INC-1","actor":"dash0","type":"signal","text":"Check-in p95 180 ms, 0% errors. Kiosk queue at Hall B down to 12."}
{"incident_id":"INC-1","actor":"captainmorgue","type":"action","text":"All parts resolved and signals normal. Proposed closing INC-1."}
{"incident_id":"INC-1","actor":"dana","type":"close","text":"Confirmed close."}
EOF
