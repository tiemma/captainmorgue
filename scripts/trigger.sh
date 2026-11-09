#!/usr/bin/env bash
set -eu

if [ $# -lt 2 ] || [ -z "${CM_URL:-}" ]; then
  echo "usage: CM_URL=<url> [CM_TOKEN=<team token>] $0 <service> <summary> [severity|resolved] [source]" >&2
  exit 2
fi

body=$(jq -nc --arg s "$1" --arg m "$2" --arg v "${3:-critical}" --arg src "${4:-trigger}" \
  '{service: $s, summary: $m, severity: $v, source: $src}')
{ [ -n "${CM_TOKEN:-}" ] && printf 'header = "Authorization: Bearer %s"\n' "$CM_TOKEN"; } |
  curl --config - -sSf --max-time 5 -X POST -H 'Content-Type: application/json' -d "$body" "${CM_URL%/}/alerts"
echo "sent $body to ${CM_URL%/}/alerts"
