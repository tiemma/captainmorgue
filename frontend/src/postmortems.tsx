import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  FileText,
  Search,
} from "lucide-react";
import { Badge, Button, ProgressStatus } from "./ui";
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
};

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
              <span>{selected.id}</span>
              <Badge tone={selected.resolved ? "success" : "neutral"}>
                {selected.resolved ? "Closed" : "Record"}
              </Badge>
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="text-title-h5">
              {selected.title}
            </h1>
            <div className="cm-postmortem-meta text-paragraph-xs">
              {selected.resolved && (
                <span>Closed {dateLabel(selected.resolved)}</span>
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
            <h2 className="text-label-md">Prevention</h2>
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
                <dd>{dateLabel(selected.opened)}</dd>
                <dt>Incident</dt>
                <dd>{selected.id}</dd>
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
                        <span>{document.id}</span>
                        {document.resolved && (
                          <span>Closed {dateLabel(document.resolved)}</span>
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
              <FileText size={24} aria-hidden="true" />
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
