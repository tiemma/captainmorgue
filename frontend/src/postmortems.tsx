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
import type { IncidentRecord, Moment, Step } from "./service-client";
import "./postmortems.css";

export type PostmortemDocument = {
  id: string;
  title: string;
  summary: string;
  resolved?: string;
  opened?: string;
  fixed_by?: string;
  parts: { name: string; resolution: string }[];
  improvements: { text: string; owner?: string; link?: string }[];
  events?: { time: string; title: string; detail?: string }[];
  rfo?: IncidentRecord;
};

export function recordToDocument(record: IncidentRecord): PostmortemDocument {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary || "",
    opened: record.opened || undefined,
    resolved: record.window?.closed || record.resolved || undefined,
    fixed_by: record.fixed_by || undefined,
    parts: (record.parts || []).map((part) => ({
      name: part.name,
      resolution: part.how,
    })),
    improvements: (record.action_items || record.improvements || []).map(
      (item) => ({
        text: item.due ? `${item.text} (due ${item.due})` : item.text,
        owner: item.owner,
        link: item.link,
      }),
    ),
    rfo: record,
  };
}

function utcTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().slice(11, 19) + " UTC";
}

function MomentList({ moments }: { moments: Moment[] }) {
  return (
    <ol className="cm-postmortem-timeline">
      {moments.map((moment, index) => (
        <li key={`${moment.ts}-${index}`}>
          <span className="cm-postmortem-event-time text-paragraph-xs">
            {utcTime(moment.ts)} {moment.actor}
          </span>
          <h3 className="text-label-sm">{moment.type}</h3>
          <p className="text-paragraph-sm">{moment.text}</p>
        </li>
      ))}
    </ol>
  );
}

function stepTags(step: Step) {
  return [
    step.failed ? "failed" : step.status,
    step.exit_code !== undefined && `exit ${step.exit_code}`,
    step.duration_ms && `${step.duration_ms} ms`,
    step.resource && `on ${step.resource}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ul className="cm-postmortem-prevention">
      {steps.map((step, index) => (
        <li key={`${step.ts}-${index}`}>
          <p className="text-paragraph-sm">{step.text}</p>
          <div className="cm-postmortem-meta text-paragraph-xs">
            <span>{step.ts}</span>
            {step.failed ? (
              <Badge tone="danger">{stepTags(step)}</Badge>
            ) : (
              <span>{stepTags(step)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TextList({ items }: { items?: string[] | null }) {
  return items?.length ? (
    <ul className="cm-postmortem-parts">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <p className="text-paragraph-sm">{item}</p>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-paragraph-sm">None recorded.</p>
  );
}

export function RfoSections({ record }: { record: IncidentRecord }) {
  const window = record.window;
  const prs = record.remediation || [];
  const changes = record.changes || [];
  return (
    <>
      {window && (
        <section className="cm-postmortem-section">
          <h2 className="text-label-md">Impact window</h2>
          <dl className="cm-postmortem-details text-paragraph-xs">
            <dt>Severity</dt>
            <dd>{record.severity || "Not set"}</dd>
            <dt>Detected</dt>
            <dd>{utcTime(window.detected)}</dd>
            <dt>Mitigated</dt>
            <dd>{utcTime(window.mitigated)}</dd>
            <dt>Resolved</dt>
            <dd>{utcTime(window.resolved)}</dd>
            <dt>Closed</dt>
            <dd>{utcTime(window.closed)}</dd>
            <dt>To mitigate</dt>
            <dd>{window.to_mitigate || "Not recorded"}</dd>
            <dt>Duration</dt>
            <dd>{window.duration || "Not recorded"}</dd>
          </dl>
        </section>
      )}
      {record.root_cause && (
        <section className="cm-postmortem-section">
          <h2 className="text-label-md">Root cause</h2>
          <p className="text-paragraph-sm">{record.root_cause}</p>
          <TextList items={record.contributing_factors} />
        </section>
      )}
      {!!record.timeline?.length && (
        <section className="cm-postmortem-section">
          <h2 className="text-label-md">Timeline</h2>
          <MomentList moments={record.timeline} />
        </section>
      )}
      <section className="cm-postmortem-section">
        <h2 className="text-label-md">What went well</h2>
        <TextList items={record.went_well} />
      </section>
      <section className="cm-postmortem-section">
        <h2 className="text-label-md">What went badly</h2>
        <TextList items={record.went_badly} />
      </section>
      {!!record.errors?.length && (
        <section className="cm-postmortem-section">
          <h2 className="text-label-md">Errors during the incident</h2>
          <MomentList moments={record.errors} />
        </section>
      )}
      {!!prs.length && (
        <section className="cm-postmortem-section">
          <h2 className="text-label-md">Fix pull requests</h2>
          <ul className="cm-postmortem-prevention">
            {prs.map((pr) => (
              <li key={pr.url}>
                <p className="text-paragraph-sm">{pr.service}</p>
                <div className="cm-postmortem-meta text-paragraph-xs">
                  <span>{pr.author}</span>
                  {externalLink(pr.url) && (
                    <a href={externalLink(pr.url)} target="_blank" rel="noopener noreferrer">
                      {pr.url}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!record.steps?.length && (
        <details className="cm-disclosure">
          <summary>Steps taken</summary>
          {!!changes.length && (
            <section className="cm-postmortem-section">
              <h2 className="text-label-md">Changes made</h2>
              <StepList steps={changes} />
            </section>
          )}
          {record.steps.map((group, index) => (
            <section className="cm-postmortem-section" key={`${group.actor}-${index}`}>
              <h2 className="text-label-md">{group.actor}</h2>
              <StepList steps={group.steps} />
            </section>
          ))}
        </details>
      )}
    </>
  );
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
          {selected.rfo && <RfoSections record={selected.rfo} />}
          {!!selected.events?.length && (
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
            <h2 className="text-label-md">
              {selected.rfo ? "Action items" : "Prevention"}
            </h2>
            {selected.improvements.length ? (
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
