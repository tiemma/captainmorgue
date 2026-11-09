import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileText,
  MessageSquare,
  Network,
  Send,
  Ship,
  Users,
} from "lucide-react";
import { Avatar, Badge, Button, Dialog, Panel, ProgressStatus } from "./ui";
import type { Tone } from "./ui";
import { SidePanel } from "./side-panel";
import { Postmortems, RfoSections, recordToDocument } from "./postmortems";
import type { PostmortemDocument } from "./postmortems";
import { SAMPLE_POSTMORTEMS } from "./postmortems-fixtures";
import { useIncident } from "./use-incident";
import {
  ackInbox,
  broadcast,
  fetchGraph,
  fetchInbox,
  fetchRecord,
  fetchRecords,
  heartbeat,
  join,
  leave,
  sendMessage,
  setIncidentStatus,
  updateTask,
} from "./service-client";
import type { Envelope, IncidentEvent, IncidentRecord, Person, TeamGraph } from "./service-client";
import { TeamGraphView } from "./team-graph";
import "./live-workspace.css";

type Tab = "Incident" | "Requests" | "Crew" | "Teams" | "Record" | "Postmortems";
type Inspector =
  { kind: "event"; event: IncidentEvent } | { kind: "person"; actor: string };
const navigation = [
  { label: "Incident", icon: Activity },
  { label: "Requests", icon: MessageSquare },
  { label: "Crew", icon: Users },
  { label: "Teams", icon: Network },
  { label: "Record", icon: FileText },
  { label: "Postmortems", icon: BookOpen },
] as const;
const requestTypes = new Set([
  "ask",
  "broadcast",
  "relay",
  "reply",
  "autoreply",
  "escalation",
]);

function timeLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function eventLabel(event: IncidentEvent) {
  if (event.type === "action" && event.text.startsWith("Working on:"))
    return "Task updated";
  const labels: { [kind: string]: string } = {
    digest: "Catch-up",
    vote_request: "Election started",
    vote: "Vote",
    elected: "Manager elected",
    autoreply: "Automatic reply",
    claim: "Resource claimed",
    release: "Claim released",
  };
  return labels[event.type] || event.type.replaceAll("_", " ");
}

function statusTone(status?: string): Tone {
  if (
    ["online", "working", "seen", "resolved", "in_incident"].includes(
      status || "",
    )
  )
    return "success";
  if (["offline", "conflict", "escalation"].includes(status || ""))
    return "danger";
  if (["suspect", "sent", "delivered"].includes(status || "")) return "amber";
  return "neutral";
}

function safeUrl(value?: string) {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function Spark({ points }: { points?: number[] }) {
  if (!points || points.length < 2) return null;
  return (
    <svg className="cm-live-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points
          .map((point, index) => `${(index / (points.length - 1)) * 100},${24 - point * 24}`)
          .join(" ")}
      />
    </svg>
  );
}

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function Empty({ children }: { children: string }) {
  return <p className="cm-live-empty text-paragraph-sm">{children}</p>;
}

function EventList({
  events,
  onSelect,
  deliveries,
  onReply,
}: {
  events: IncidentEvent[];
  onSelect: (event: IncidentEvent) => void;
  deliveries?: Record<string, Record<string, string>> | null;
  onReply?: (event: IncidentEvent) => void;
}) {
  if (!events.length)
    return <Empty>No events have been recorded here yet.</Empty>;
  return (
    <ol className="cm-live-events">
      {events.map((event) => (
        <li key={event.seq} data-status={event.type}>
          <div className="cm-live-event-marker" aria-hidden="true" />
          <div className="cm-live-event-content">
            <div className="cm-live-event-meta text-paragraph-xs">
              <span className="text-label-xs">
                {event.actor || "CaptainMorgue"}
              </span>
              <Badge tone={statusTone(event.type)}>{eventLabel(event)}</Badge>
              <time dateTime={event.ts}>{timeLabel(event.ts)}</time>
            </div>
            <button
              className="cm-live-event-open text-paragraph-sm"
              onClick={() => onSelect(event)}
            >
              {event.text || event.type}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            {!!event.to?.length && (
              <p className="cm-live-caption text-paragraph-xs">
                To {event.to.join(", ")}
              </p>
            )}
            {!!Object.keys(deliveries?.[String(event.seq)] || {}).length && (
              <div className="cm-live-deliveries">
                {Object.entries(deliveries?.[String(event.seq)] || {}).map(
                  ([actor, status]) => (
                    <span className="text-paragraph-xs" key={actor}>
                      {actor}
                      <Badge tone={statusTone(status)}>{status}</Badge>
                    </span>
                  ),
                )}
              </div>
            )}
            {onReply && event.type === "ask" && (
              <Button onClick={() => onReply(event)}>Reply</Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function Elapsed({ opened, closed }: { opened: string | null; closed: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!opened || closed) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [opened, closed]);
  if (!opened) return <>--:--:--</>;
  const end = closed ? Date.parse(closed) : now;
  return <time dateTime={opened}>{clock(end - Date.parse(opened))}</time>;
}

export function LiveWorkspace() {
  const { state, events, connection, error } = useIncident();
  const [tab, setTab] = useState<Tab>("Incident");
  const [inspector, setInspector] = useState<Inspector>();
  const [joining, setJoining] = useState(false);
  const [identity, setIdentity] = useState("");
  const [browserPresence, setBrowserPresence] = useState(false);
  const [actor, setActor] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<"commander" | "responder" | "scribe">(
    "responder",
  );
  const [task, setTask] = useState("");
  const [recipient, setRecipient] = useState("");
  const [kind, setKind] = useState<"ask" | "broadcast" | "relay">("ask");
  const [inbox, setInbox] = useState<Envelope[]>([]);
  const [unread, setUnread] = useState(0);
  const [taskDraft, setTaskDraft] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<IncidentEvent>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [record, setRecord] = useState<IncidentRecord>();
  const [recordError, setRecordError] = useState("");
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordAttempt, setRecordAttempt] = useState(0);
  const [archive, setArchive] = useState<PostmortemDocument[]>();
  const [archiveError, setArchiveError] = useState("");
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  const [graph, setGraph] = useState<TeamGraph>();
  const [graphError, setGraphError] = useState("");
  const [graphAttempt, setGraphAttempt] = useState(0);
  const teams = state?.teams || [];
  const people = state?.people || {};
  const claims = state?.claims || [];
  const counts = state?.counts;
  const connected = connection === "connected";
  const incidentId = state?.incident.id;
  const active = !!state?.incident.opened;
  const selectedPerson: Person | undefined =
    inspector?.kind === "person" ? people[inspector.actor] : undefined;

  useEffect(() => {
    if (!identity || !browserPresence) return;
    const interval = window.setInterval(() => {
      heartbeat(identity).catch((reason: unknown) =>
        setActionError(
          reason instanceof Error
            ? reason.message
            : "Browser heartbeat failed.",
        ),
      );
    }, 5000);
    return () => window.clearInterval(interval);
  }, [identity, browserPresence]);

  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    setInbox([]);
    setUnread(0);
    (async () => {
      let after: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const page = await fetchInbox(identity, after, controller.signal);
          after = page.cursor;
          setUnread(page.unread ?? 0);
          if (page.messages?.length)
            setInbox((current) => [...current, ...page.messages!].slice(-50));
        } catch (reason) {
          if (controller.signal.aborted) return;
          setActionError(errorText(reason, "Inbox could not be read."));
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
        }
      }
    })();
    return () => controller.abort();
  }, [identity]);

  async function run(action: () => Promise<unknown>, success: string, fallback: string) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (reason) {
      setActionError(errorText(reason, fallback));
    } finally {
      setBusy(false);
    }
  }

  const markSeen = () => {
    const last = inbox[inbox.length - 1];
    if (!identity || !last) return;
    run(
      async () => {
        await ackInbox(identity, last.seq);
        setInbox([]);
        setUnread(0);
      },
      "Inbox marked seen.",
      "Inbox could not be acknowledged.",
    );
  };

  const saveTask = (event: FormEvent) => {
    event.preventDefault();
    if (!identity || !incidentId || !taskDraft.trim()) return;
    run(
      async () => {
        await updateTask(incidentId, identity, taskDraft.trim());
        setTaskDraft("");
      },
      "Task updated.",
      "Task could not be updated.",
    );
  };

  const leaveIncident = () => {
    if (!identity || !incidentId) return;
    run(
      async () => {
        await leave(incidentId, identity);
        setIdentity("");
        setBrowserPresence(false);
        setInbox([]);
        setReply(undefined);
      },
      "You left the incident.",
      "Could not leave the incident.",
    );
  };

  const startReply = (event: IncidentEvent) => {
    if (busy) return;
    if (message.trim() && reply?.seq !== event.seq) {
      setNotice("Send or clear your current draft before replying to another ask.");
      return;
    }
    setReply(event);
    setRecipient(event.actor);
  };

  useEffect(() => {
    if (tab !== "Record" || !incidentId) return;
    const controller = new AbortController();
    setRecordLoading(true);
    setRecordError("");
    fetchRecord(incidentId, controller.signal)
      .then(setRecord)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setRecordError(
            reason instanceof Error
              ? reason.message
              : "The record could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecordLoading(false);
      });
    return () => controller.abort();
  }, [tab, incidentId, state?.incident.closed, recordAttempt]);

  useEffect(() => {
    if (tab !== "Postmortems") return;
    const controller = new AbortController();
    setArchiveError("");
    fetchRecords(controller.signal)
      .then((list) =>
        Promise.all(
          (list || []).map((item) => fetchRecord(item.id, controller.signal)),
        ),
      )
      .then((records) =>
        setArchive(
          records.length ? records.map(recordToDocument) : SAMPLE_POSTMORTEMS,
        ),
      )
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setArchiveError(
            reason instanceof Error
              ? reason.message
              : "The postmortem archive could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [tab, state?.incident.closed, archiveAttempt]);

  async function moveIncident(status: "resolved" | "closed") {
    if (!incidentId || !identity || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const result = await setIncidentStatus(incidentId, {
        actor: identity,
        status,
      });
      setNotice(`${incidentId} is ${result.status}.`);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "The status did not change.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "Teams") return;
    const controller = new AbortController();
    setGraphError("");
    fetchGraph(controller.signal)
      .then(setGraph)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setGraphError(
            reason instanceof Error
              ? reason.message
              : "The team graph could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [tab, events.length, graphAttempt]);

  async function joinWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!incidentId || !actor.trim() || !team || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const previous = people[actor.trim()];
      await join(incidentId, {
        actor: actor.trim(),
        team,
        role,
        task: task.trim() || previous?.task,
        repo: previous?.repo,
        tools: previous?.tools,
      });
      setIdentity(actor.trim());
      setBrowserPresence(!previous?.last_seen);
      setJoining(false);
      setNotice(`Joined as ${actor.trim()}.`);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Could not join the incident.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (
      !identity ||
      !connected ||
      !message.trim() ||
      !(reply?.actor || recipient.trim() || kind === "relay") ||
      busy
    )
      return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const text = message.trim();
      if (reply)
        await sendMessage({ from: identity, to: [reply.actor], kind: "reply", text, reply_to: reply.seq });
      else if (kind === "relay") await broadcast(identity, text);
      else
        await sendMessage({
          from: identity,
          to: recipient
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          kind,
          text,
        });
      setMessage("");
      setReply(undefined);
      setNotice(
        "Message accepted by CaptainMorgue. Delivery appears in the stream.",
      );
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Message could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inspect = (event: IncidentEvent) =>
    setInspector({ kind: "event", event });

  return (
    <div className="cm-app cm-live">
      <aside className="cm-live-sidebar">
        <a href="/" className="cm-live-brand text-label-lg">
          <span>
            <Ship size={19} />
          </span>
          CaptainMorgue
        </a>
        <p className="cm-live-nav-caption text-subheading-xxs">Workspace</p>
        <nav aria-label="Workspace">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              type="button"
              className={`text-label-sm ${tab === label ? "is-selected" : ""}`}
              aria-current={tab === label ? "page" : undefined}
              key={label}
              onClick={() => {
                setTab(label);
                setInspector(undefined);
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
              {label === "Requests" && unread > 0 && (
                <span className="cm-live-nav-count" aria-label={`${unread} unread`}>
                  <Badge tone="danger" dot={false}>{unread}</Badge>
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="cm-live-sidebar-context">
          <span className="text-label-xs">{incidentId || "Connecting"}</span>
          <p className="text-paragraph-xs">
            {state?.incident.title || "Waiting for incident state"}
          </p>
        </div>
        <div className="cm-live-identity">
          <Avatar name={identity || "Observer"} />
          <div>
            <span className="text-label-xs">{identity || "Observer"}</span>
            <p className="text-paragraph-xs">
              {identity ? "Browser session" : "Read-only until you join"}
            </p>
          </div>
        </div>
      </aside>
      <div className="cm-live-shell">
        <header className="cm-live-topbar">
          <span className="text-label-sm">
            {tab}
            {state?.commander && <><br /><span className="text-paragraph-xs">Commander {state.commander}</span></>}
          </span>
          <div>
            <span className="cm-live-connection text-paragraph-xs">
              <span
                className={`cm-status-dot ${connected ? "is-info" : "is-warning"}`}
                aria-hidden="true"
              />
              {connected
                ? "Live"
                : connection === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </span>
            {identity &&
              state &&
              !["resolved", "closed"].includes(state.incident.status) && (
                <Button
                  onClick={() => moveIncident("resolved")}
                  disabled={busy || !connected}
                >
                  Resolve
                </Button>
              )}
            {identity && state && state.incident.status !== "closed" && (
              <Button
                onClick={() => moveIncident("closed")}
                disabled={busy || !connected}
              >
                Close
              </Button>
            )}
            {!identity && (
              <Button
                onClick={() => {
                  setJoining(true);
                  setActionError("");
                }}
                disabled={!state || !connected}
              >
                Join
              </Button>
            )}
          </div>
        </header>
        <div className="cm-live-body">
          <main className="cm-live-main">
            {!connected && (
              <div className="cm-live-notice text-paragraph-sm" role="status">
                {state
                  ? "Connection interrupted. Showing the last received state; actions are paused."
                  : "Connecting to CaptainMorgue. Waiting for the first incident state."}
              </div>
            )}
            {error && (
              <p className="cm-live-error text-paragraph-sm" role="alert">
                {error}
              </p>
            )}
            {actionError && !joining && (
              <p className="cm-live-error text-paragraph-sm" role="alert">
                {actionError}
              </p>
            )}
            {notice && (
              <p className="cm-live-notice text-paragraph-sm" role="status">
                {notice}
              </p>
            )}
            {tab !== "Postmortems" && (
              <div className="cm-live-page-heading">
                <div>
                  <h1 className="text-title-h6">
                    {tab === "Incident"
                      ? state?.incident.title || "Incident"
                      : tab}
                  </h1>
                  <p className="text-paragraph-sm">
                    {tab === "Incident"
                      ? active
                        ? "Agent activity, ownership, and coordination as they happen."
                        : "Waiting for the first incident event."
                      : tab === "Requests"
                        ? "Agent messages and delivery receipts from the incident stream."
                        : tab === "Crew"
                          ? "Responders, their roles, and the work they own."
                          : tab === "Teams"
                            ? "The team tree, and how teams relate in this incident."
                          : "The incident record returned by CaptainMorgue."}
                  </p>
                </div>
                {state && (
                  <span
                    className={
                      active && ["resolved", "closed"].includes(state.incident.status)
                        ? "cm-toe-tag"
                        : undefined
                    }
                  >
                    <Badge tone={statusTone(state.incident.status)}>
                      {active ? state.incident.status : "Waiting"}
                    </Badge>
                  </span>
                )}
              </div>
            )}
            {tab === "Incident" && (
              <>
                {state && (
                  <div className="cm-kpi-row">
                    <div className="cm-stat-card">
                      <span>Parts</span>
                      <strong>{counts?.parts ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Claims</span>
                      <strong>{counts?.claims ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Crew online</span>
                      <strong>{`${counts?.crew_online ?? 0} / ${counts?.crew_total ?? 0}`}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Events</span>
                      <strong>{counts?.events ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Open asks</span>
                      <strong>{counts?.open_asks ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Pull requests</span>
                      <strong>{counts?.open_prs ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Action items</span>
                      <strong>{counts?.action_items ?? 0}</strong>
                    </div>
                    <div className="cm-stat-card">
                      <span>Elapsed</span>
                      <strong>
                        <Elapsed
                          opened={state.incident.opened}
                          closed={state.incident.closed}
                        />
                      </strong>
                    </div>
                  </div>
                )}
                {state?.conflict && (
                  <section className="cm-live-attention is-conflict">
                    <Badge tone="danger">Conflict recorded</Badge>
                    <p className="text-paragraph-sm">{state.conflict.text}</p>
                    <Button onClick={() => inspect(state.conflict!)}>
                      Inspect
                    </Button>
                  </section>
                )}
                {state?.relay && (
                  <section className="cm-live-attention">
                    <Badge tone="info">Broadcast</Badge>
                    <p className="text-paragraph-sm">
                      {state.relay.from}: {state.relay.text}
                      {!!state.relay.to?.length && (
                        <span className="cm-live-caption text-paragraph-xs">
                          {" "}To {state.relay.to.join(", ")}. {state.relay.why}
                        </span>
                      )}
                    </p>
                  </section>
                )}
                <div className="cm-live-incident-grid">
                  <Panel title="Activity">
                    <EventList events={events} onSelect={inspect} />
                  </Panel>
                  <div className="cm-live-context">
                    <Panel title="Alerts">
                      <EventList
                        events={events
                          .filter((event) => ["alert", "signal"].includes(event.type))
                          .slice(-5)
                          .reverse()}
                        onSelect={inspect}
                      />
                    </Panel>
                    <Panel title="Claims">
                      {claims.length ? (
                        <ul className="cm-live-claims">
                          {claims.map((claim) => (
                            <li key={claim.key}>
                              <div>
                                <span className="text-label-sm">
                                  {claim.actor}
                                </span>
                                <Badge tone="amber">Claimed</Badge>
                              </div>
                              <p className="text-paragraph-xs">{claim.key}</p>
                              <p className="text-paragraph-sm">{claim.text}</p>
                              <span className="text-paragraph-xs">
                                Expires {timeLabel(claim.expires)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Empty>No active resource claims.</Empty>
                      )}
                    </Panel>
                    {!!state?.parts?.length && (
                      <Panel title="Work">
                        {state.parts.map((part) => (
                          <div className="cm-live-work-part" key={part.id}>
                            <div>
                              <span className="text-label-sm">{part.name}</span>
                              <Badge tone={statusTone(part.status)}>
                                {part.status}
                              </Badge>
                            </div>
                            <p className="text-paragraph-xs">
                              {part.owner || "Unassigned"} / {part.progress}%
                            </p>
                            {part.note && (
                              <p className="text-paragraph-sm">{part.note}</p>
                            )}
                          </div>
                        ))}
                      </Panel>
                    )}
                    {!!Object.keys(state?.signals || {}).length && (
                      <details className="cm-disclosure cm-signals-disclosure" open>
                        <summary>Signals</summary>
                        {Object.entries(state?.signals || {}).map(
                          ([name, signal]) => (
                            <div className="cm-live-signal" key={name}>
                              <span className="text-paragraph-sm">{signal.label || name}</span>
                              <Spark points={signal.spark} />
                              <Badge
                                tone={
                                  signal.status === "critical" ? "danger" : signal.status === "warn" ? "amber" : "neutral"
                                }
                              >
                                {signal.value}
                              </Badge>
                            </div>
                          ),
                        )}
                      </details>
                    )}
                  </div>
                </div>
              </>
            )}
            {tab === "Requests" && (
              <>
                {identity && (
                  <Panel
                    title="Inbox"
                    action={
                      <Button disabled={busy || !inbox.length} onClick={markSeen}>
                        Mark seen
                      </Button>
                    }
                  >
                    {inbox.length ? (
                      <ul className="cm-live-claims">
                        {inbox.map((item) => {
                          const ask = events.find((event) => event.seq === item.seq);
                          return (
                            <li key={item.seq}>
                              <div>
                                <span className="text-label-sm">{item.from}</span>
                                <Badge tone={item.priority === "interrupt" ? "danger" : "neutral"}>
                                  {item.kind}
                                </Badge>
                              </div>
                              <p className="text-paragraph-sm">{item.text}</p>
                              {item.kind === "ask" && ask && (
                                <Button onClick={() => startReply(ask)}>Reply</Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <Empty>{`Nothing waiting for ${identity}.`}</Empty>
                    )}
                  </Panel>
                )}
                <Panel title="Messages">
                  <EventList
                    events={events.filter((event) =>
                      requestTypes.has(event.type),
                    )}
                    onSelect={inspect}
                    deliveries={state?.deliveries}
                    onReply={identity ? startReply : undefined}
                  />
                </Panel>
                {identity ? (
                  <form className="cm-live-compose" onSubmit={submitMessage}>
                    <div className="cm-live-compose-header">
                      <h2 className="text-label-sm">
                        {reply ? `Reply to ${reply.actor}` : "Message"}
                      </h2>
                      {reply && (
                        <Button disabled={busy} onClick={() => {
                          if (message.trim()) {
                            setNotice("Send or clear this draft before cancelling the reply.");
                            return;
                          }
                          setReply(undefined);
                        }}>
                          Cancel reply
                        </Button>
                      )}
                    </div>
                    {reply ? (
                      <p className="cm-live-caption text-paragraph-xs">
                        Replying to #{reply.seq}: {reply.text}
                      </p>
                    ) : (
                      <div className="cm-live-form-grid">
                        {kind !== "relay" && <label className="cm-field">
                          To
                          <input
                            disabled={busy}
                            value={recipient}
                            onChange={(event) =>
                              setRecipient(event.target.value)
                            }
                            placeholder="Actor, team, or root"
                            required
                          />
                        </label>}
                        <label className="cm-field">
                          Kind
                          <select
                            disabled={busy}
                            value={kind}
                            onChange={(event) =>
                              setKind(event.target.value as typeof kind)
                            }
                          >
                            <option value="ask">Ask</option>
                            <option value="broadcast">Broadcast</option>
                            <option value="relay">Relay (CaptainMorgue picks)</option>
                          </select>
                        </label>
                      </div>
                    )}
                    <label className="cm-field">
                      Message
                      <textarea
                        disabled={busy}
                        rows={3}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        required
                      />
                    </label>
                    <div className="cm-live-compose-footer">
                      <span className="text-paragraph-xs">
                        Sent as {identity}; recipient agents receive it through
                        CaptainMorgue.
                      </span>
                      <Button
                        type="submit"
                        tone="amber"
                        disabled={
                          !connected ||
                          busy ||
                          !message.trim() ||
                          !(reply?.actor || recipient.trim() || kind === "relay")
                        }
                      >
                        <Send size={14} />
                        {busy ? "Sending" : "Send"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="cm-live-caption text-paragraph-sm">
                    Join with your actor and team to send a message from this
                    browser.
                  </p>
                )}
              </>
            )}
            {tab === "Crew" && identity && (
              <form className="cm-live-compose" onSubmit={saveTask}>
                <div className="cm-live-compose-header">
                  <h2 className="text-label-sm">
                    {identity}: {people[identity]?.task || "No current task recorded"}
                  </h2>
                  <Button disabled={busy} onClick={leaveIncident}>
                    Leave
                  </Button>
                </div>
                <label className="cm-field">
                  Task
                  <input
                    disabled={busy}
                    value={taskDraft}
                    onChange={(event) => setTaskDraft(event.target.value)}
                    placeholder="What are you working on now?"
                    required
                  />
                </label>
                <div className="cm-live-compose-footer">
                  <span className="text-paragraph-xs">Shown to the crew as your current task.</span>
                  <Button type="submit" tone="amber" disabled={busy || !connected || !taskDraft.trim()}>
                    Update task
                  </Button>
                </div>
              </form>
            )}
            {tab === "Crew" && (
              <div className="cm-live-team-grid">
                {teams.length ? (
                  teams.map((teamState) => (
                    <Panel key={teamState.id} title={teamState.name}>
                      <div className="cm-live-team-info">
                        <p className="text-paragraph-xs">
                          Manager: {teamState.manager || "Not elected"} / Term{" "}
                          {teamState.term}
                        </p>
                        <p className="text-paragraph-xs">
                          Owns:{" "}
                          {(teamState.owns || []).join(", ") || "Not recorded"}
                        </p>
                      </div>
                      {Object.entries(people)
                        .filter(([, person]) => person.team === teamState.id)
                        .map(([name, person]) => (
                          <button
                            className="cm-live-person"
                            data-status={person.status}
                            key={name}
                            onClick={() =>
                              setInspector({ kind: "person", actor: name })
                            }
                          >
                            <Avatar name={name} />
                            <span>
                              <span className="text-label-sm">{name}</span>
                              <span className="text-paragraph-xs">
                                {person.role || "Role not recorded"}
                                {teamState.manager === name ? " / manager" : ""}
                              </span>
                              <span className="text-paragraph-xs">
                                {person.task || "No current task recorded"}
                              </span>
                            </span>
                            <Badge tone={statusTone(person.status)}>
                              {person.status}
                            </Badge>
                          </button>
                        ))}
                      {!Object.values(people).some(
                        (person) => person.team === teamState.id,
                      ) && <Empty>No responders have joined this team.</Empty>}
                    </Panel>
                  ))
                ) : (
                  <Empty>The service has not provided a roster yet.</Empty>
                )}
              </div>
            )}
            {tab === "Record" && (
              <>
                {recordLoading && (
                  <ProgressStatus state="working">
                    Loading record
                  </ProgressStatus>
                )}
                {recordError && (
                  <div className="cm-live-error" role="alert">
                    <p className="text-paragraph-sm">{recordError}</p>
                    <Button
                      onClick={() => setRecordAttempt((value) => value + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {record && record.id === incidentId ? (
                  <article className="cm-live-record">
                    <div className="cm-live-record-meta text-paragraph-xs">
                      <span>{record.id}</span>
                      {record.duration && <span>{record.duration}</span>}
                      <span>{record.people} people</span>
                      <span>{record.teams} teams</span>
                      <span>{record.conflicts} conflicts</span>
                      <Button
                        onClick={() => setRecordAttempt((value) => value + 1)}
                        disabled={recordLoading}
                      >
                        Refresh
                      </Button>
                    </div>
                    {record.summary && (
                      <section>
                        <h2 className="text-label-md">Summary</h2>
                        <p className="text-paragraph-sm">{record.summary}</p>
                      </section>
                    )}
                    <RfoSections record={record} />
                    <section>
                      <h2 className="text-label-md">Resolution</h2>
                      {record.parts?.length ? (
                        record.parts.map((part, index) => (
                          <div
                            className="cm-live-record-part"
                            key={`${part.name}-${index}`}
                          >
                            <h3 className="text-label-sm">{part.name}</h3>
                            <p className="text-paragraph-sm">{part.how}</p>
                          </div>
                        ))
                      ) : (
                        <Empty>
                          Resolution details have not been written yet.
                        </Empty>
                      )}
                    </section>
                    <section>
                      <h2 className="text-label-md">All events</h2>
                      <EventList
                        events={record.events || []}
                        onSelect={inspect}
                      />
                    </section>
                    <section>
                      <h2 className="text-label-md">Action items</h2>
                      {record.improvements?.length ? (
                        <ul className="cm-live-improvements">
                          {record.improvements.map((item, index) => (
                            <li key={index}>
                              <p className="text-paragraph-sm">{item.text}</p>
                              <span className="text-paragraph-xs">
                                {item.owner || "Owner not assigned"}
                                {item.due && `, due ${item.due}`}
                              </span>
                              {safeUrl(item.link) && (
                                <a
                                  href={safeUrl(item.link)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-label-xs"
                                >
                                  Follow-up
                                  <ArrowUpRight size={12} />
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Empty>No follow-ups have been recorded.</Empty>
                      )}
                    </section>
                  </article>
                ) : (
                  !recordLoading &&
                  !recordError && (
                    <Empty>No incident record is available yet.</Empty>
                  )
                )}
              </>
            )}
            {tab === "Teams" && (
              <TeamGraphView
                graph={graph}
                loading={!graph}
                error={graphError}
                onRetry={() => setGraphAttempt((attempt) => attempt + 1)}
              />
            )}
            {tab === "Postmortems" && (
              <Postmortems
                documents={archive}
                loading={!archive && !archiveError}
                error={archiveError || undefined}
                onRetry={() => setArchiveAttempt((value) => value + 1)}
              />
            )}
          </main>
          {inspector && (
            <SidePanel
              title={inspector.kind === "person" ? inspector.actor : "Event"}
              onClose={() => setInspector(undefined)}
            >
              {inspector.kind === "person" ? (
                selectedPerson ? (
                  <div
                    className="cm-live-profile"
                    data-status={selectedPerson.status}
                  >
                    <Avatar name={inspector.actor} />
                    <Badge tone={statusTone(selectedPerson.status)}>
                      {selectedPerson.status}
                    </Badge>
                    <dl>
                      <dt>Role</dt>
                      <dd>{selectedPerson.role || "Not recorded"}</dd>
                      <dt>Team</dt>
                      <dd>
                        {teams.find((item) => item.id === selectedPerson.team)
                          ?.name || selectedPerson.team}
                      </dd>
                      <dt>Task</dt>
                      <dd>{selectedPerson.task || "Not recorded"}</dd>
                      <dt>Last seen</dt>
                      <dd>{timeLabel(selectedPerson.last_seen)}</dd>
                      <dt>Repository</dt>
                      <dd>{selectedPerson.repo || "Not recorded"}</dd>
                      <dt>Tools</dt>
                      <dd>
                        {selectedPerson.tools?.join(", ") || "Not recorded"}
                      </dd>
                      <dt>Owns</dt>
                      <dd>
                        {teams
                          .find((item) => item.id === selectedPerson.team)
                          ?.owns?.join(", ") || "Not recorded"}
                      </dd>
                    </dl>
                  </div>
                ) : (
                  <Empty>
                    This responder is no longer in the current state.
                  </Empty>
                )
              ) : (
                <div
                  className="cm-live-event-detail"
                  data-status={inspector.event.type}
                >
                  <Badge tone={statusTone(inspector.event.type)}>
                    {inspector.event.type}
                  </Badge>
                  <p className="text-label-sm">{inspector.event.actor}</p>
                  <p className="text-paragraph-sm">{inspector.event.text}</p>
                  <p className="text-paragraph-xs">
                    #{inspector.event.seq} / {timeLabel(inspector.event.ts)}
                  </p>
                  {inspector.event.why && (
                    <section>
                      <h3 className="text-label-sm">Routing</h3>
                      <p className="text-paragraph-sm">{inspector.event.why}</p>
                    </section>
                  )}
                  {inspector.event.resource && (
                    <section>
                      <h3 className="text-label-sm">Resource</h3>
                      <p className="text-paragraph-sm">
                        {inspector.event.resource.namespace} /{" "}
                        {inspector.event.resource.kind} /{" "}
                        {inspector.event.resource.name}
                      </p>
                    </section>
                  )}
                  {inspector.event.artifacts?.map((artifact, index) =>
                    safeUrl(artifact.url) ? (
                      <a
                        key={index}
                        href={safeUrl(artifact.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-label-xs"
                      >
                        {artifact.label}
                        <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <span key={index} className="text-paragraph-xs">
                        {artifact.label}
                      </span>
                    ),
                  )}
                </div>
              )}
            </SidePanel>
          )}
        </div>
      </div>
      {joining && (
        <Dialog title="Join" onClose={() => setJoining(false)}>
          <form className="cm-live-join" onSubmit={joinWorkspace}>
            <p className="text-paragraph-sm">
              Choose an actor and team explicitly. Existing agent profiles are
              preserved; browser heartbeats are sent only for a new browser
              identity.
            </p>
            <label className="cm-field">
              Actor
              <input
                            disabled={busy}
                value={actor}
                onChange={(event) => {
                  const value = event.target.value;
                  setActor(value);
                  const existing = people[value.trim()];
                  if (existing) {
                    setTeam(existing.team);
                    setRole(existing.role || "responder");
                    setTask(existing.task || "");
                  }
                }}
                placeholder="Your GitHub login"
                required
              />
            </label>
            <label className="cm-field">
              Team
              <select
                            disabled={busy}
                value={team}
                onChange={(event) => setTeam(event.target.value)}
                required
              >
                <option value="">Choose a team</option>
                {teams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cm-field">
              Role
              <select
                            disabled={busy}
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
              >
                <option value="responder">Responder</option>
                <option value="commander">Commander</option>
                <option value="scribe">Scribe</option>
              </select>
            </label>
            <label className="cm-field">
              Task
              <input
                            disabled={busy}
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="What are you working on?"
              />
            </label>
            {actionError && (
              <p className="cm-live-error text-paragraph-sm" role="alert">
                {actionError}
              </p>
            )}
            <Button
              type="submit"
              tone="amber"
              disabled={busy || !connected || !actor.trim() || !team}
            >
              {busy ? "Joining" : "Join incident"}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
