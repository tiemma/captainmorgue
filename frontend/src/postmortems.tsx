import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  FileText,
  Search,
} from "lucide-react";
import { Badge, Button, ProgressStatus } from "./ui";
import { RecordTimeline } from "./record-timeline";
import "./postmortems.css";

export type PostmortemCommand = {
  seq: number;
  ts: string;
  actor: string;
  team?: string;
  tool: string;
  command: string;
  outcome: string;
  exit_code?: number;
  duration_ms?: number;
  cwd?: string;
  resource?: { kind: string; namespace?: string; name: string };
  changed: boolean;
  led_to_resolution: boolean;
};

export type PostmortemStep = {
  seq: number;
  ts: string;
  actor: string;
  team?: string;
  kind: string;
  text: string;
  command?: string;
  outcome?: string;
};

export type PostmortemDocument = {
  id: string;
  title: string;
  summary: string;
  status?: string;
  resolved?: string;
  opened?: string;
  fixed_by?: string;
  parts: { name: string; resolution: string }[];
  improvements: { text: string; owner?: string; link?: string }[] | null;
  events?: { time: string; title: string; detail?: string }[];
  steps?: PostmortemStep[];
  commands?: PostmortemCommand[];
};

function clockLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}

function outcomeDot(outcome: string) {
  return outcome === "ok" ? "is-green" : outcome === "failed" ? "is-critical" : "is-warning";
}

function runbook(document: PostmortemDocument, commands: PostmortemCommand[]) {
  return [
    `# ${document.id}: ${document.title}`,
    "# Commands that changed the system on the way to the resolution, in order.",
    ...commands.flatMap((run) => [
      `# ${clockLabel(run.ts)} ${run.actor} via ${run.tool}${run.cwd ? ` in ${run.cwd}` : ""}`,
      run.command,
    ]),
  ].join("\n");
}

export type PostmortemsProps = {
  documents?: PostmortemDocument[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function externalLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function Postmortems({
  documents = [],
  loading = false,
  error,
  onRetry,
}: PostmortemsProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [selectedId]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const selected = documents.find((document) => document.id === selectedId);
  const search = query.trim().toLocaleLowerCase();
  const visible = documents.filter((document) =>
    `${document.title} ${document.summary}`
      .toLocaleLowerCase()
      .includes(search),
  );

  useEffect(() => {
    if (selectedId) headingRef.current?.focus();
    else if (openerRef.current) {
      const row = document.getElementById(openerRef.current.id);
      row?.focus();
    }
  }, [selectedId]);

  return (
    <div className="cm-postmortems">
      <header className="cm-postmortems-header">
        {selected ? (
          <Button
            aria-label="Back to postmortems"
            onClick={() => setSelectedId(undefined)}
          >
            <ArrowLeft size={15} />
            Postmortems
          </Button>
        ) : (
          <div>
            <h1 className="text-title-h6">Postmortems</h1>
            <p className="text-paragraph-sm">
              What happened, how the crew responded, and what comes next.
            </p>
          </div>
        )}
      </header>
      {error && (
        <div className="cm-postmortems-error" role="alert">
          <span className="cm-empty-icon" aria-hidden="true">
            <CircleAlert size={20} />
          </span>
          <div>
            <h2 className="text-label-sm">Unavailable</h2>
            <p className="text-paragraph-sm">{error}</p>
          </div>
          {onRetry && (
            <Button onClick={onRetry} disabled={loading}>
              Retry
            </Button>
          )}
        </div>
      )}
      {loading && (
        <div className="cm-postmortems-loading" role="status">
          <ProgressStatus state="working">Loading postmortems</ProgressStatus>
        </div>
      )}
      {selected ? (
        <article className="cm-postmortem-document">
          <header className="cm-postmortem-title">
            <div className="cm-postmortem-meta text-paragraph-xs">
              <span className="cm-postmortem-id">{selected.id}</span>
              <span className={selected.resolved ? "cm-toe-tag" : undefined}>
                <Badge tone={selected.resolved ? "success" : "neutral"}>
                  {selected.resolved ? "Closed" : "Record"}
                </Badge>
              </span>
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="text-title-h5">
              {selected.title}
            </h1>
            <div className="cm-postmortem-meta text-paragraph-xs">
              {selected.resolved && (
                <span>
                  Closed <time dateTime={selected.resolved}>{dateLabel(selected.resolved)}</time>
                </span>
              )}
              {selected.fixed_by && (
                <span>Resolved by {selected.fixed_by}</span>
              )}
            </div>
          </header>
          <section className="cm-postmortem-section">
            <h2 className="text-label-md">Summary</h2>
            <p className="text-paragraph-sm">
              {selected.summary || "No summary has been recorded."}
            </p>
          </section>
          <section className="cm-postmortem-section">
            <h2 className="text-label-md">Resolution</h2>
            {selected.parts.length ? (
              <ul className="cm-postmortem-parts">
                {selected.parts.map((part, index) => (
                  <li key={`${part.name}-${index}`}>
                    <h3 className="text-label-sm">{part.name}</h3>
                    <p className="text-paragraph-sm">
                      {part.resolution || "No resolution has been recorded."}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-paragraph-sm">
                No resolution details have been recorded.
              </p>
            )}
          </section>
          {!!selected.commands?.some((run) => run.led_to_resolution) && (
            <section className="cm-postmortem-section">
              <div className="cm-postmortem-section-heading">
                <h2 className="text-label-md">Commands that resolved it</h2>
                <Button
                  onClick={() => {
                    const text = runbook(
                      selected,
                      selected.commands!.filter((run) => run.led_to_resolution),
                    );
                    navigator.clipboard?.writeText(text).then(
                      () => setCopied(true),
                      () => setCopied(false),
                    );
                  }}
                >
                  {copied ? "Copied" : "Copy as runbook"}
                </Button>
              </div>
              <ol className="cm-postmortem-commands">
                {selected.commands
                  .filter((run) => run.led_to_resolution)
                  .map((run) => (
                    <li key={run.seq}>
                      <div className="cm-postmortem-meta text-paragraph-xs">
                        <time dateTime={run.ts}>{clockLabel(run.ts)}</time>
                        <span>{run.actor}</span>
                        <span>{run.tool}</span>
                        {run.resource && (
                          <span className="cm-postmortem-id">
                            {[run.resource.namespace, run.resource.kind, run.resource.name].filter(Boolean).join("/")}
                          </span>
                        )}
                      </div>
                      <pre className="cm-postmortem-command">
                        <code>{run.command}</code>
                      </pre>
                    </li>
                  ))}
              </ol>
            </section>
          )}
          {!!selected.steps?.length && (
            <section className="cm-postmortem-section">
              <h2 className="text-label-md">Timeline</h2>
              <RecordTimeline
                steps={selected.steps}
                commands={selected.commands || []}
                opened={selected.opened}
                resolved={selected.resolved}
              />
            </section>
          )}
          {!!selected.commands?.length && (
            <details className="cm-disclosure">
              <summary>
                All commands run <small>{selected.commands.length}</small>
              </summary>
              <ol className="cm-postmortem-all-commands">
                {selected.commands.map((run) => (
                  <li key={run.seq}>
                    <span className={`cm-status-dot ${outcomeDot(run.outcome)}`} aria-hidden="true" />
                    <code>{run.command}</code>
                    <span className="cm-postmortem-meta text-paragraph-xs">
                      {run.actor} / {run.outcome}
                      {run.exit_code !== undefined && ` / exit ${run.exit_code}`}
                      {run.changed ? " / change" : " / read"}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {!selected.steps?.length && !!selected.events?.length && (
            <section className="cm-postmortem-section">
              <h2 className="text-label-md">Timeline</h2>
              <ol className="cm-postmortem-timeline">
                {selected.events.map((event, index) => (
                  <li key={`${event.time}-${index}`}>
                    <span className="cm-postmortem-event-time text-paragraph-xs">
                      {event.time}
                    </span>
                    <h3 className="text-label-sm">{event.title}</h3>
                    {event.detail && (
                      <p className="text-paragraph-sm">{event.detail}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="cm-postmortem-section">
            <h2 className="text-label-md">Prevention</h2>
            {selected.improvements?.length ? (
              <ul className="cm-postmortem-prevention">
                {selected.improvements.map((item, index) => {
                  const href = externalLink(item.link);
                  return (
                    <li key={`${item.text}-${index}`}>
                      <p className="text-paragraph-sm">{item.text}</p>
                      <div className="cm-postmortem-meta text-paragraph-xs">
                        <span>
                          {item.owner
                            ? `Owner: ${item.owner}`
                            : "Owner not assigned"}
                        </span>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Follow-up
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-paragraph-sm">
                No follow-ups have been recorded.
              </p>
            )}
          </section>
          {selected.opened && (
            <details className="cm-disclosure">
              <summary>Details</summary>
              <dl className="cm-postmortem-details text-paragraph-xs">
                <dt>Opened</dt>
                <dd>
                  <time dateTime={selected.opened}>{dateLabel(selected.opened)}</time>
                </dd>
                <dt>Incident</dt>
                <dd className="cm-postmortem-id">{selected.id}</dd>
              </dl>
            </details>
          )}
        </article>
      ) : (
        <div className="cm-postmortems-library" aria-busy={loading}>
          {!!documents.length && (
            <label className="cm-postmortems-search text-label-xs">
              <span>Search</span>
              <span className="cm-postmortems-search-field">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search postmortems"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles and summaries"
                  className="text-paragraph-sm"
                />
              </span>
            </label>
          )}
          {visible.length ? (
            <ul className="cm-postmortems-list">
              {visible.map((document) => (
                <li key={document.id}>
                  <button
                    id={`cm-postmortem-${document.id}`}
                    className="cm-postmortems-row"
                    onClick={(event) => {
                      openerRef.current = event.currentTarget;
                      setSelectedId(document.id);
                    }}
                  >
                    <FileText size={18} aria-hidden="true" />
                    <span className="cm-postmortems-row-body">
                      <span className="cm-postmortems-row-title text-label-md">
                        {document.title}
                      </span>
                      <span className="cm-postmortems-row-summary text-paragraph-sm">
                        {document.summary || "No summary has been recorded."}
                      </span>
                      <span className="cm-postmortem-meta text-paragraph-xs">
                        <span className="cm-postmortem-id">{document.id}</span>
                        {document.resolved && (
                          <span className="cm-postmortem-closed">
                            <span
                              className="cm-status-dot is-resolved"
                              aria-hidden="true"
                            />
                            <span>
                              Closed <time dateTime={document.resolved}>{dateLabel(document.resolved)}</time>
                            </span>
                          </span>
                        )}
                        {document.fixed_by && <span>{document.fixed_by}</span>}
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : !loading && !error ? (
            <div className="cm-postmortems-empty">
              <span className="cm-empty-icon" aria-hidden="true">
                <FileText size={20} />
              </span>
              <h2 className="text-label-lg">
                {query.trim() ? "No matches" : "No postmortems yet"}
              </h2>
              <p className="text-paragraph-sm">
                {query.trim()
                  ? "Try another title or phrase from the summary."
                  : "Saved incident records will appear here when they are available."}
              </p>
              {query.trim() && (
                <Button onClick={() => setQuery("")}>Clear search</Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
