# CaptainMorgue design system

Mortuary steel: cold green-grey neutrals, hairline rules and small corners, built dark-first for a wall screen in a dim room (light theme included). Familjen Grotesk for names and numbers, Public Sans for prose, IBM Plex Mono for anything a machine wrote. Status is carried by shape as well as hue, so it survives a washed-out projector. Manila is reserved for the toe tag, which a part or the incident earns only when it is resolved. Motion is fast and ease-out on transform and opacity; the only spring is the toe tag landing, and reduced motion turns movement into a short fade.

Open `index.html` for the live reference. `tokens.css` is the source; its content is inlined into `index.html`.

## Tokens

- Fonts: `--font-display`, `--font-body`, `--font-mono`
- Neutrals: `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`, `--fg`, `--fg-2`, `--fg-3`, `--fg-inverse`, `--scrim`, `--material`
- Brand: `--brass`, `--brass-soft`, `--tag-paper`, `--tag-paper-2`, `--tag-ink`, `--tag-string`
- Status (each with `-bg` and `-line`): `--critical`, `--investigating`, `--resolved`, `--info`, `--quiet`, `--conflict`
- Focus: `--focus`, `--focus-ring`
- Type: `--text-2xs` to `--text-4xl`, `--text-clock`, `--leading-tight|snug|body`, `--tracking-display|body|label`
- Spacing: `--space-1` (4) to `--space-10` (80)
- Radius: `--radius-xs|sm|md|lg|pill`
- Elevation: `--elev-1|2|3`, `--edge-highlight`
- Motion: `--dur-instant|press|fast|base|enter|exit|tag`, `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--ease-hover`, `--ease-spring`, `--press-scale`

## Components

- Incident header (severity, id, status, live, elapsed clock, open parts, people, conflicts)
- Status pill (critical, investigating, resolved, info, quiet, conflict) and toe tag (`.toe`, `.tag-card`)
- Presence chip (online, quiet, offline, manager, root)
- Command tree (nested teams, manager badge, last update, quiet flag, election running)
- Event log (filters, row types, command, log excerpt, artifact link, new-row entrance)
- Swimlane timeline (action, decision, relay, conflict, part resolved, incident resolved line)
- Relay message (route through CaptainMorgue, reason per recipient, skipped recipients)
- Conflict alert (two sides, rule plus model explanation, who was told, actions)
- Workstream row (signal-recovery meter, toe tag on resolve)
- Manager election (ballots, tally, result)
- The record (facts, parts, improvements with Gitar status, past-incident match)
- Buttons (primary, secondary, ghost, danger, tag, small, disabled), inputs (composer, field, error), empty state, toast
