import "./event-categories.css";

export type EventCategory =
  | "alert"
  | "conflict"
  | "investigation"
  | "decision"
  | "work"
  | "message"
  | "resolution"
  | "system";

export const eventCategories: { id: EventCategory; label: string }[] = [
  { id: "alert", label: "Alerts and signals" },
  { id: "conflict", label: "Conflicts" },
  { id: "investigation", label: "Investigation" },
  { id: "decision", label: "Decisions" },
  { id: "work", label: "Commands and claims" },
  { id: "message", label: "Messages" },
  { id: "resolution", label: "Resolution" },
  { id: "system", label: "Crew and system" },
];

const byType: Record<string, EventCategory> = {
  alert: "alert",
  page: "alert",
  signal: "alert",
  conflict: "conflict",
  "conflict flagged": "conflict",
  investigation: "investigation",
  decision: "decision",
  action: "work",
  claim: "work",
  ship: "work",
  ownership: "work",
  ask: "message",
  reply: "message",
  relay: "message",
  broadcast: "message",
  autoreply: "message",
  escalation: "message",
  recovered: "resolution",
  close: "resolution",
  resolved: "resolution",
};

export function eventCategory(type: string): EventCategory {
  return byType[type.toLowerCase()] || "system";
}

export function EventLegend({ types }: { types: string[] }) {
  const counts = new Map<EventCategory, number>();
  for (const type of types) {
    const category = eventCategory(type);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const present = eventCategories.filter((category) => counts.has(category.id));
  if (!present.length) return null;
  return (
    <ul className="cm-event-legend" aria-label="Event colours">
      {present.map((category) => (
        <li key={category.id} data-category={category.id}>
          <span className="cm-event-swatch" aria-hidden="true" />
          {category.label}
          <span className="cm-event-legend-count">{counts.get(category.id)}</span>
        </li>
      ))}
    </ul>
  );
}
