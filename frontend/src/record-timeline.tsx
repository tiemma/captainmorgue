import { useRef, useState } from "react";
import { eventCategories, eventCategory } from "./event-categories";
import type { EventCategory } from "./event-categories";
import type { PostmortemCommand, PostmortemStep } from "./postmortems";
import "./record-timeline.css";

const stepCategory: Record<string, EventCategory> = {
  detected: "alert",
  investigated: "investigation",
  decided: "decision",
  claimed: "work",
  changed: "work",
  acted: "work",
  shipped: "work",
  conflict: "conflict",
  recovered: "resolution",
  resolved: "resolution",
};

export function categoryOfStep(kind: string): EventCategory {
  return stepCategory[kind] || eventCategory(kind);
}

type Mark = {
  key: string;
  ts: number;
  category: EventCategory;
  title: string;
  actor: string;
  text?: string;
  command?: string;
  outcome?: string;
  exitCode?: number;
  resolving?: boolean;
  read?: boolean;
};

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}

function outcomeDot(outcome?: string) {
  return outcome === "ok" ? "is-green" : outcome === "failed" ? "is-critical" : "is-warning";
}

export function RecordTimeline({
  steps,
  commands,
  opened,
  resolved,
}: {
  steps: PostmortemStep[];
  commands: PostmortemCommand[];
  opened?: string | null;
  resolved?: string | null;
}) {
  const [active, setActive] = useState<string>();
  const [warm, setWarm] = useState(false);
  const cool = useRef<number>(undefined);

  const stepSeqs = new Set(steps.map((step) => step.seq));
  const marks: Mark[] = [
    ...steps.map((step) => {
      const run = commands.find((item) => item.seq === step.seq);
      return {
        key: `s${step.seq}`,
        ts: Date.parse(step.ts),
        category: categoryOfStep(step.kind),
        title: step.kind,
        actor: step.actor,
        text: step.command ? undefined : step.text,
        command: step.command,
        outcome: step.outcome,
        exitCode: run?.exit_code,
        resolving: run?.led_to_resolution,
      };
    }),
    ...commands
      .filter((run) => !stepSeqs.has(run.seq))
      .map((run) => ({
        key: `c${run.seq}`,
        ts: Date.parse(run.ts),
        category: "work" as const,
        title: run.changed ? "changed" : "checked",
        actor: run.actor,
        command: run.command,
        outcome: run.outcome,
        exitCode: run.exit_code,
        read: !run.changed,
      })),
  ]
    .filter((mark) => !Number.isNaN(mark.ts))
    .sort((a, b) => a.ts - b.ts);

  if (!marks.length) return <p className="cm-record-timeline-empty text-paragraph-sm">No steps or commands were recorded.</p>;

  const start = Math.min(opened ? Date.parse(opened) : Infinity, marks[0].ts);
  const end = Math.max(resolved ? Date.parse(resolved) : -Infinity, marks[marks.length - 1].ts);
  const span = Math.max(end - start, 1);
  const position = (ts: number) => `${((ts - start) / span) * 100}%`;
  const present = eventCategories.filter((category) => marks.some((mark) => mark.category === category.id));

  function show(key: string) {
    window.clearTimeout(cool.current);
    setActive(key);
  }
  function hide() {
    setActive(undefined);
    setWarm(true);
    window.clearTimeout(cool.current);
    cool.current = window.setTimeout(() => setWarm(false), 400);
  }

  return (
    <div className={`cm-record-timeline${warm ? " is-warm" : ""}`}>
      <ul className="cm-event-legend cm-record-timeline-legend" aria-label="Timeline colours">
        {present.map((category) => (
          <li key={category.id} data-category={category.id}>
            <span className="cm-event-swatch" aria-hidden="true" />
            {category.label}
          </li>
        ))}
      </ul>
      <div className="cm-record-axis" role="group" aria-label="Incident timeline">
        <span className="cm-record-axis-line" aria-hidden="true" />
        {marks.map((mark, index) => (
          <button
            type="button"
            key={mark.key}
            data-category={mark.category}
            className={`cm-record-mark${mark.read ? " is-read" : ""}${mark.resolving ? " is-resolving" : ""}${active === mark.key ? " is-active" : ""}`}
            style={{ left: position(mark.ts), ["--cm-mark-row" as string]: index % 3 }}
            aria-label={`${clock(mark.ts)} ${mark.actor} ${mark.title}: ${mark.command || mark.text || ""}`}
            aria-describedby={active === mark.key ? `${mark.key}-tip` : undefined}
            onMouseEnter={() => show(mark.key)}
            onMouseLeave={hide}
            onFocus={() => show(mark.key)}
            onBlur={hide}
          >
            <span className="cm-record-dot" aria-hidden="true" />
            {active === mark.key && (
              <span
                className={`cm-record-tip${(mark.ts - start) / span > 0.6 ? " is-end" : (mark.ts - start) / span < 0.25 ? " is-start" : ""}`}
                role="tooltip"
                id={`${mark.key}-tip`}
              >
                <span className="cm-record-tip-meta">
                  <time>{clock(mark.ts)}</time>
                  <span>{mark.actor}</span>
                  <span className="cm-record-tip-kind">{mark.title}</span>
                </span>
                {mark.command ? <code>{mark.command}</code> : mark.text && <span className="cm-record-tip-text">{mark.text}</span>}
                {mark.outcome && (
                  <span className="cm-record-tip-outcome">
                    <span className={`cm-status-dot ${outcomeDot(mark.outcome)}`} aria-hidden="true" />
                    {mark.outcome}
                    {mark.exitCode !== undefined && ` / exit ${mark.exitCode}`}
                    {mark.resolving && " / led to the resolution"}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
        <span className="cm-record-axis-label is-start">{clock(start)}</span>
        <span className="cm-record-axis-label is-end">{clock(end)}</span>
      </div>
      <ol className="cm-record-steps">
        {marks.map((mark) => (
          <li
            key={mark.key}
            data-category={mark.category}
            className={`${active === mark.key ? "is-active" : ""}${mark.read ? " is-read" : ""}`}
            onMouseEnter={() => show(mark.key)}
            onMouseLeave={hide}
          >
            <time className="cm-record-step-time">{clock(mark.ts)}</time>
            <span className="cm-record-step-marker" aria-hidden="true" />
            <div className="cm-record-step-body">
              <div className="cm-record-step-meta">
                <span className="cm-record-step-kind">{mark.title}</span>
                <span>{mark.actor}</span>
                {mark.resolving && <span className="cm-record-step-flag">Led to the resolution</span>}
              </div>
              {mark.command ? (
                <code className="cm-record-step-command">{mark.command}</code>
              ) : (
                mark.text && <p>{mark.text}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
