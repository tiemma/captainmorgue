import { useCallback, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  FileText,
  Flag,
  GitBranch,
  Layers3,
  Link2,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Radio,
  Send,
  ShieldAlert,
  Ship,
  Sparkles,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Panel,
  Receipt,
} from "./ui";
import "./tokens.css";
import "./styles.css";

type View = "incident" | "messages" | "crew" | "record" | "join";
type Scenario = "active" | "conflict" | "reconnecting" | "resolved" | "empty";
type Part = {
  id: string;
  title: string;
  detail: string;
  owner: string | null;
  team: string;
  done: boolean;
  progress: number;
};
type PreviewEvent = {
  id: string;
  actor: string;
  kind: string;
  text: string;
  time: string;
  evidence?: string;
  tone: "neutral" | "amber" | "danger" | "success" | "info";
};
const starterParts: Part[] = [
  {
    id: "checkin",
    title: "Restore check-in",
    detail: "Canary aborted. Verify kiosk recovery.",
    owner: "Emmanuel",
    team: "Registration",
    done: false,
    progress: 65,
  },
  {
    id: "database",
    title: "Drain database connections",
    detail: "58 / 100 connections. Watching recovery.",
    owner: "Sammy",
    team: "Platform",
    done: false,
    progress: 55,
  },
  {
    id: "payments",
    title: "Verify card payments",
    detail: "Run a payment through the merch stand.",
    owner: null,
    team: "Ticketing",
    done: false,
    progress: 20,
  },
];
const starterEvents: PreviewEvent[] = [
  {
    id: "e1",
    actor: "Radar",
    kind: "Investigation",
    text: "The new badge-email lookup scans 48,000 rows. Each request holds a database connection for 3 seconds.",
    time: "14:46",
    evidence: "Open investigation findings",
    tone: "info",
  },
  {
    id: "e2",
    actor: "Emmanuel",
    kind: "Decision",
    text: "Abort check-in canary v1.8. Keep the database primary running while connections drain.",
    time: "14:44",
    evidence: "rollout/checkin",
    tone: "amber",
  },
  {
    id: "e3",
    actor: "CaptainMorgue",
    kind: "Conflict flagged",
    text: "A database restart could interrupt the check-in rollback. Emmanuel and Sammy need to coordinate.",
    time: "14:44",
    tone: "danger",
  },
  {
    id: "e4",
    actor: "Sammy",
    kind: "Action",
    text: "Checked confdb: 96 of 100 connections in use. Most are held by check-in.",
    time: "14:42",
    evidence: "confdb connection snapshot",
    tone: "neutral",
  },
  {
    id: "e5",
    actor: "CaptainMorgue",
    kind: "Crew assembled",
    text: "Registration, Platform and Ticketing joined. All three services share confdb.",
    time: "14:41",
    tone: "neutral",
  },
];
const crew = [
  {
    name: "Emmanuel",
    initials: "EB",
    team: "Registration",
    role: "Team lead",
    job: "Aborting the check-in canary",
    state: "Working",
    time: "Updated 1m ago",
  },
  {
    name: "Sammy",
    initials: "SA",
    team: "Platform",
    role: "Team lead",
    job: "Watching database connections",
    state: "Working",
    time: "Updated 2m ago",
  },
  {
    name: "Jubril",
    initials: "JO",
    team: "Ticketing",
    role: "Responder",
    job: "Available to verify payments",
    state: "Available",
    time: "Updated just now",
  },
];
const nav: {
  id: View;
  label: string;
  icon: typeof Activity;
  count?: string;
}[] = [
  { id: "incident", label: "Incident", icon: Activity },
  { id: "messages", label: "Messages", icon: MessageSquare, count: "2" },
  { id: "crew", label: "Crew", icon: Users },
  { id: "record", label: "The record", icon: BookOpen },
];

export function CaptainWorkspace({
  initialView = "incident",
  scenario = "active",
  wallMode = false,
}: {
  initialView?: View;
  scenario?: Scenario;
  wallMode?: boolean;
}) {
  const [view, setView] = useState<View>(wallMode ? "incident" : initialView);
  const [previousView, setPreviousView] = useState<View>(initialView);
  const [wall, setWall] = useState(wallMode);
  const [parts, setParts] = useState(
    starterParts.map((part) => ({
      ...part,
      done: scenario === "resolved",
      progress: scenario === "resolved" ? 100 : part.progress,
    })),
  );
  const [resolved, setResolved] = useState(scenario === "resolved");
  const [declared, setDeclared] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [conflictDecision, setConflictDecision] = useState("");
  const [inspector, setInspector] = useState<PreviewEvent | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [scope, setScope] = useState("Platform team");
  const [sent, setSent] = useState<
    { text: string; scope: string; thread: string }[]
  >([]);
  const [dialog, setDialog] = useState<{
    kind: "resolve" | "close" | "decision" | "declare";
    part?: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("All activity");
  const [selectedThread, setSelectedThread] = useState("Database coordination");
  const draft = drafts[selectedThread] ?? "";
  function setDraft(value: string) {
    setDrafts((current) => ({ ...current, [selectedThread]: value }));
  }
  const ack = acknowledged.includes(selectedThread);
  const paymentAcknowledged = acknowledged.includes("Payment verification");
  const unreadRequests = [
    "Database coordination",
    "Payment verification",
  ].filter((thread) => !acknowledged.includes(thread)).length;
  const [events, setEvents] = useState(starterEvents);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setReason("");
  }, []);
  const isEmpty = scenario === "empty" && !declared;
  const isStale = scenario === "reconnecting";
  const openParts = parts.filter((part) => !part.done);
  function notify(text: string) {
    setToast(text);
  }
  function addEvent(text: string, kind: string = "Action") {
    setEvents((current) => [
      {
        id: `local-${Date.now()}`,
        actor: "Jubril",
        kind,
        text,
        time: "Now",
        tone: "info",
      },
      ...current,
    ]);
  }
  function navigate(next: View) {
    setView(next);
    setInspector(null);
  }
  function chooseThread(next: string) {
    setSelectedThread(next);
    setScope(
      next === "Payment verification"
        ? "Emmanuel"
        : next === "Incident broadcast"
          ? "All responders"
          : "Platform team",
    );
  }
  function toggleWall() {
    if (wall) {
      setWall(false);
      setView(previousView);
    } else {
      setPreviousView(view);
      setView("incident");
      setInspector(null);
      setWall(true);
    }
  }
  function submitDialog() {
    if (!reason.trim() || isStale || wall) return;
    if (dialog?.kind === "resolve") {
      setParts((current) =>
        current.map((part) =>
          part.id === dialog.part
            ? { ...part, done: true, progress: 100 }
            : part,
        ),
      );
      addEvent(
        `Resolved ${parts.find((part) => part.id === dialog.part)?.title}: ${reason}`,
        "Part resolved",
      );
      notify("Resolution recorded in this preview.");
    }
    if (dialog?.kind === "decision") {
      setConflictDecision(reason);
      addEvent(`Coordination decision: ${reason}`, "Decision");
      notify("Decision recorded. No commands were stopped.");
    }
    if (dialog?.kind === "close") {
      setResolved(true);
      addEvent(`Closed the incident: ${reason}`, "Incident closed");
      setView("record");
    }
    if (dialog?.kind === "declare") {
      setDeclared(true);
      addEvent(`Declared incident: ${reason}`, "Incident opened");
    }
    closeDialog();
  }
  function send() {
    if (!draft.trim() || isStale || wall) return;
    setSent((current) => [
      ...current,
      { text: draft.trim(), scope, thread: selectedThread },
    ]);
    addEvent(`Message to ${scope}: ${draft.trim()}`, "Message");
    setDraft("");
    notify("Sample message added locally.");
  }
  function copyRecord() {
    const text =
      "CaptainMorgue design preview - INC-2041: Check-in kiosks failing at Hall B";
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(text)
        .then(() => notify("Sample record summary copied."))
        .catch(() => notify("Copy unavailable in this preview."));
    else notify("Copy unavailable in this preview.");
  }
  const visibleEvents = events.filter(
    (event) =>
      filter === "All activity" ||
      (filter === "Decisions"
        ? event.kind.includes("Decision") || event.kind === "Conflict flagged"
        : Boolean(event.evidence)),
  );

  return (
    <div className={`cm-app${wall ? " cm-wall" : ""}`}>
      {!wall && (
        <aside className="cm-sidebar">
          <a
            className="cm-brand"
            href="#incident"
            onClick={(event) => {
              event.preventDefault();
              navigate("incident");
            }}
          >
            <span className="cm-brand-mark">
              <Ship size={22} strokeWidth={1.4} />
            </span>
            <span>
              CaptainMorgue<small>WHERE INCIDENTS GO TO DIE</small>
            </span>
          </a>
          <div className="cm-workspace-switch">
            <span className="cm-workspace-icon">CN</span>
            <span>
              Cloud Native Hackathon<small>Conference operations</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <div className="cm-nav-label">WORKSPACE</div>
          <nav aria-label="Workspace">
            {nav.map((item) => (
              <button
                key={item.id}
                className={`cm-nav-item${view === item.id ? " is-active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={17} strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.count && unreadRequests > 0 && (
                  <span className="cm-nav-count">{unreadRequests}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="cm-sidebar-incident">
            <span className="cm-nav-label">ON THE DESK</span>
            <button onClick={() => navigate("incident")}>
              <span
                className={`cm-status-dot ${resolved || isEmpty ? "is-green" : "is-red"}`}
              />
              <span>
                {isEmpty ? "No active incident" : "INC-2041"}
                <small>
                  {isEmpty
                    ? "The desk is clear"
                    : resolved
                      ? "Resolved"
                      : "Check-in at Hall B"}
                </small>
              </span>
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="cm-sidebar-bottom">
            <div className="cm-preview-label">
              <span />
              Design preview<small>Sample incident. Local interactions.</small>
            </div>
            <button className="cm-user" onClick={() => navigate("join")}>
              <Avatar name="Jubril Oyetunji" />
              <span>
                Jubril Oyetunji<small>Ticketing team</small>
              </span>
              <MoreHorizontal size={17} />
            </button>
          </div>
        </aside>
      )}
      <div className="cm-main-shell">
        <header className="cm-topbar">
          <div className="cm-breadcrumb">
            Conference operations <ChevronRight size={13} />
            <span>
              {view === "join"
                ? "Join the incident"
                : nav.find((item) => item.id === view)?.label}
            </span>
          </div>
          <div className="cm-topbar-right">
            <span className="cm-preview-top">DESIGN PREVIEW</span>
            <span className="cm-connection">
              <span className={`cm-status-dot${isStale ? " is-amber" : ""}`} />
              {isStale ? "Reconnect scenario" : "Sample data"}
            </span>
            <Button
              aria-label={wall ? "Exit wall screen" : "Open wall screen"}
              onClick={toggleWall}
            >
              <Maximize2 size={15} />
              <span>{wall ? "Exit wall screen" : "Wall screen"}</span>
            </Button>
          </div>
        </header>
        {isStale && (
          <div className="cm-disconnect" role="status">
            <WifiOff size={16} />
            <div>
              <strong>Connection interrupted.</strong> Showing the last known
              incident. Your draft is saved in this preview.
            </div>
            <span>Last update 14:46</span>
          </div>
        )}
        <div className={`cm-workspace${inspector ? " has-inspector" : ""}`}>
          <main className="cm-page">
            {view === "join" ? (
              <div className="cm-join-layout">
                <div className="cm-join-story">
                  <span className="cm-eyebrow">A SHARED INCIDENT DESK</span>
                  <h1>
                    Every responder.
                    <br />
                    One clear picture.
                  </h1>
                  <p>
                    Your crew is working the incident. Join the room to see what
                    changed, coordinate the next move, and leave a record worth
                    keeping.
                  </p>
                  <div className="cm-join-quote">
                    <Ship size={30} strokeWidth={1.2} />
                    <span>Where incidents go to die.</span>
                  </div>
                </div>
                <div className="cm-join-card">
                  <Badge tone="danger" dot>
                    Active incident
                  </Badge>
                  <h2>
                    Check-in kiosks failing
                    <br />
                    at Hall B
                  </h2>
                  <p className="cm-subtitle">INC-2041 / Opened 14:41</p>
                  <div className="cm-join-facts">
                    <Users size={17} />
                    <span>3 responders across 3 teams</span>
                  </div>
                  <label className="cm-field">
                    Join the design preview as
                    <select defaultValue="Jubril Oyetunji">
                      <option>Jubril Oyetunji</option>
                    </select>
                  </label>
                  <label className="cm-field">
                    Team
                    <input value="Ticketing" readOnly />
                  </label>
                  <div className="cm-inline-note">
                    <Command size={17} />
                    <p>
                      Your browser and agent are separate connections. This
                      preview does not connect a real agent.
                    </p>
                  </div>
                  <Button
                    tone="amber"
                    onClick={() => {
                      navigate("incident");
                      notify("Joined the sample incident as Jubril.");
                    }}
                  >
                    Join incident <ArrowRight size={16} />
                  </Button>
                  <button
                    className="cm-text-button"
                    onClick={() => navigate("incident")}
                  >
                    Observe the preview
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="cm-page-title">
                  <div>
                    <div className="cm-eyebrow">
                      {view === "incident"
                        ? "INCIDENT DESK"
                        : view === "messages"
                          ? "KEEP THE CREW IN SYNC"
                          : view === "crew"
                            ? "PEOPLE BEHIND THE WORK"
                            : "THE INCIDENT, REMEMBERED"}
                    </div>
                    <h1>
                      {view === "incident"
                        ? isEmpty
                          ? "The incident desk"
                          : "Check-in kiosks failing at Hall B"
                        : view === "messages"
                          ? "Messages"
                          : view === "crew"
                            ? "One incident. One crew."
                            : "The record"}
                    </h1>
                    <p>
                      {view === "incident"
                        ? isEmpty
                          ? "Your crew is ready when something needs attention."
                          : "Attendees are waiting at check-in. Card payments at the merch stand are also affected."
                        : view === "messages"
                          ? "A clear route, a named recipient, and a reason for every message."
                          : view === "crew"
                            ? "Know who is working, what they own, and where they need a hand."
                            : "Built from what happened. Ready for the next crew."}
                    </p>
                  </div>
                  {view === "incident" && !isEmpty && !wall && (
                    <div className="cm-page-action">
                      <Badge tone={resolved ? "success" : "danger"} dot>
                        {resolved ? "Resolved" : "SEV 1 / Active"}
                      </Badge>
                      <Button
                        disabled={resolved || isStale}
                        onClick={() => {
                          setDialog({ kind: "close" });
                          setReason("");
                        }}
                      >
                        <CheckCheck size={16} />
                        Close incident
                      </Button>
                    </div>
                  )}
                  {view === "record" && (
                    <Button onClick={copyRecord}>
                      <Copy size={15} />
                      Copy summary
                    </Button>
                  )}
                </div>
                {isEmpty ? (
                  <div className="cm-quiet-state">
                    <EmptyState
                      title="A quiet desk."
                      action={
                        <Button
                          tone="amber"
                          onClick={() => setDialog({ kind: "declare" })}
                        >
                          <Flag size={16} />
                          Declare a sample incident
                        </Button>
                      }
                    >
                      No active incident in this preview. When something needs
                      your crew, this is where the story starts.
                    </EmptyState>
                    <div className="cm-quiet-footer">
                      <Ship size={18} />
                      The best incident is the one you never have.
                    </div>
                  </div>
                ) : (
                  <>
                    {view === "incident" && (
                      <>
                        <div className="cm-incident-meta">
                          <span className="cm-mono">INC-2041</span>
                          <span>
                            <Clock3 size={14} />
                            Opened 14:41
                          </span>
                          <span>
                            <Users size={14} />3 teams / 3 responders
                          </span>
                          <span>
                            <Layers3 size={14} />
                            {openParts.length} open parts
                          </span>
                          <span className="cm-meta-owner">
                            Coordinated by <b>CaptainMorgue</b>
                          </span>
                        </div>
                        {resolved ? (
                          <div className="cm-resolved-banner">
                            <CheckCheck size={24} />
                            <div>
                              <h2>This one is in the morgue.</h2>
                              <p>
                                The sample incident is resolved. The decisions
                                and evidence are kept in the record.
                              </p>
                            </div>
                            <Button onClick={() => navigate("record")}>
                              Read the record <ArrowRight size={15} />
                            </Button>
                          </div>
                        ) : (
                          <section className="cm-attention">
                            <div className="cm-section-label">
                              <span>NEEDS ATTENTION</span>
                              <span className="cm-count">
                                {conflictDecision ? "1" : "2"}
                              </span>
                            </div>
                            <div className="cm-attention-grid">
                              <div
                                className={`cm-attention-card ${conflictDecision ? "is-decided" : "is-conflict"}`}
                              >
                                <span className="cm-attention-icon">
                                  {conflictDecision ? (
                                    <Check size={20} />
                                  ) : (
                                    <ShieldAlert size={20} />
                                  )}
                                </span>
                                <div className="cm-attention-content">
                                  <div className="cm-attention-kicker">
                                    {conflictDecision
                                      ? "COORDINATION DECISION RECORDED"
                                      : "CONFLICT / CONFDB"}
                                  </div>
                                  <h2>
                                    {conflictDecision
                                      ? "The crew has a plan."
                                      : "Two actions. One database."}
                                  </h2>
                                  <p>
                                    {conflictDecision ||
                                      "Sammy's restart could interrupt Emmanuel's rollback. Coordinate before either goes further."}
                                  </p>
                                  <div className="cm-attention-footer">
                                    <span>
                                      <span className="cm-tiny-avatar">E</span>
                                      <span className="cm-tiny-avatar">S</span>
                                      Emmanuel + Sammy
                                    </span>
                                    {!wall && (
                                      <button
                                        disabled={isStale}
                                        onClick={() => {
                                          setDialog({ kind: "decision" });
                                          setReason("");
                                        }}
                                      >
                                        {conflictDecision
                                          ? "Review decision"
                                          : "Review conflict"}{" "}
                                        <ArrowUpRight size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="cm-attention-card">
                                <span className="cm-attention-icon">
                                  <MessageSquare size={20} />
                                </span>
                                <div className="cm-attention-content">
                                  <div className="cm-attention-kicker">
                                    {paymentAcknowledged
                                      ? "ACKNOWLEDGED BY YOU"
                                      : "DIRECT ASK / FOR YOU"}
                                  </div>
                                  <h2>Can you verify card payments?</h2>
                                  <p>
                                    Emmanuel needs a real payment checked at the
                                    merch stand before calling recovery.
                                  </p>
                                  <div className="cm-attention-footer">
                                    <span>
                                      From Emmanuel{" "}
                                      <span className="cm-mid-dot">/</span> 2m
                                      ago
                                    </span>
                                    {!wall && (
                                      <button
                                        onClick={() => {
                                          chooseThread("Payment verification");
                                          navigate("messages");
                                        }}
                                      >
                                        Open message <ArrowUpRight size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>
                        )}
                        <div className="cm-incident-columns">
                          <section className="cm-activity-panel">
                            <div className="cm-section-heading">
                              <h2>Across the incident</h2>
                              <Badge tone="neutral">
                                <Radio size={12} />
                                Sample timeline
                              </Badge>
                            </div>
                            <div className="cm-feed-toolbar">
                              <div className="cm-filter-tabs">
                                {["All activity", "Decisions", "Evidence"].map(
                                  (name) => (
                                    <button
                                      className={
                                        filter === name ? "is-selected" : ""
                                      }
                                      key={name}
                                      aria-pressed={filter === name}
                                      onClick={() => setFilter(name)}
                                    >
                                      {name}
                                    </button>
                                  ),
                                )}
                              </div>
                              <span className="cm-sort-label">
                                Latest first <ArrowDown size={12} />
                              </span>
                            </div>
                            <div className="cm-feed">
                              {visibleEvents.map((event) => (
                                <article className="cm-event" key={event.id}>
                                  <div
                                    className={`cm-event-symbol cm-tone-${event.tone}`}
                                  >
                                    {event.kind === "Investigation" ? (
                                      <Sparkles size={17} />
                                    ) : event.kind === "Conflict flagged" ? (
                                      <ShieldAlert size={17} />
                                    ) : event.kind === "Decision" ? (
                                      <GitBranch size={17} />
                                    ) : (
                                      <Activity size={17} />
                                    )}
                                  </div>
                                  <div className="cm-event-body">
                                    <div className="cm-event-heading">
                                      <strong>{event.actor}</strong>
                                      <span
                                        className={`cm-event-kind cm-text-${event.tone}`}
                                      >
                                        {event.kind}
                                      </span>
                                      <time>{event.time}</time>
                                    </div>
                                    <p>{event.text}</p>
                                    {event.evidence && (
                                      <button
                                        className="cm-evidence-link"
                                        onClick={() => setInspector(event)}
                                      >
                                        <Link2 size={13} />
                                        {event.evidence}
                                        <ArrowUpRight size={12} />
                                      </button>
                                    )}
                                  </div>
                                  <button
                                    className="cm-event-open"
                                    aria-label={`Inspect ${event.kind} by ${event.actor}`}
                                    onClick={() => setInspector(event)}
                                  >
                                    <ChevronRight size={15} />
                                  </button>
                                </article>
                              ))}
                            </div>
                            <div className="cm-timeline-origin">
                              <span />
                              Incident opened from a check-in alert at 14:41
                            </div>
                          </section>
                          <aside className="cm-situation">
                            <Panel
                              title="Parts of the incident"
                              action={
                                <span className="cm-mono cm-muted">
                                  {openParts.length} open
                                </span>
                              }
                            >
                              {parts.map((part) => (
                                <div className="cm-part" key={part.id}>
                                  <div className="cm-part-heading">
                                    <h3>{part.title}</h3>
                                    {part.done && (
                                      <Badge tone="success">
                                        <Check size={11} />
                                        Resolved
                                      </Badge>
                                    )}
                                  </div>
                                  <p>{part.detail}</p>
                                  <div className="cm-meter">
                                    <span
                                      style={{ width: `${part.progress}%` }}
                                      className={part.done ? "is-done" : ""}
                                    />
                                  </div>
                                  <div className="cm-part-footer">
                                    <span>
                                      {part.owner ? (
                                        <>
                                          <Avatar small name={part.owner} />
                                          {part.owner}
                                        </>
                                      ) : (
                                        <span className="cm-unowned">
                                          Needs an owner
                                        </span>
                                      )}
                                    </span>
                                    {!wall &&
                                      !part.done &&
                                      (part.owner ? (
                                        <button
                                          disabled={isStale}
                                          onClick={() => {
                                            setDialog({
                                              kind: "resolve",
                                              part: part.id,
                                            });
                                            setReason("");
                                          }}
                                        >
                                          Resolve <ChevronRight size={12} />
                                        </button>
                                      ) : (
                                        <button
                                          disabled={isStale}
                                          onClick={() => {
                                            setParts((current) =>
                                              current.map((item) =>
                                                item.id === part.id
                                                  ? { ...item, owner: "Jubril" }
                                                  : item,
                                              ),
                                            );
                                            addEvent(
                                              `Claimed ${part.title}`,
                                              "Ownership",
                                            );
                                            notify(
                                              "You own payment verification in this preview.",
                                            );
                                          }}
                                        >
                                          Take this <ArrowRight size={12} />
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </Panel>
                            <Panel
                              title="Recovery signals"
                              action={
                                <span className="cm-sample-caption">
                                  SAMPLE
                                </span>
                              }
                            >
                              <div className="cm-signal-row">
                                <span>
                                  Check-in p95<small>Was 4.2 s</small>
                                </span>
                                <strong className="cm-text-amber">
                                  1.1 <small>s</small>
                                </strong>
                              </div>
                              <div className="cm-signal-row">
                                <span>
                                  Database connections
                                  <small>Was 96 / 100</small>
                                </span>
                                <strong>
                                  58 <small>/ 100</small>
                                </strong>
                              </div>
                              <div className="cm-signal-row">
                                <span>
                                  Payment errors<small>Was 9.1%</small>
                                </span>
                                <strong className="cm-text-success">
                                  0.3<small>%</small>
                                </strong>
                              </div>
                              <div className="cm-panel-footnote">
                                <Clock3 size={12} />
                                Snapshot at 14:46
                              </div>
                            </Panel>
                            <button
                              className="cm-crew-summary"
                              onClick={() => navigate("crew")}
                            >
                              <span className="cm-avatar-stack">
                                {crew.map((person) => (
                                  <Avatar
                                    key={person.name}
                                    small
                                    name={person.name}
                                  />
                                ))}
                              </span>
                              <span>
                                3 people on it
                                <small>See responsibilities</small>
                              </span>
                              <ArrowUpRight size={15} />
                            </button>
                          </aside>
                        </div>
                      </>
                    )}
                    {view === "messages" && (
                      <div className="cm-messaging">
                        <aside className="cm-thread-list">
                          <div className="cm-thread-list-title">
                            Incident conversations<span>3</span>
                          </div>
                          {[
                            {
                              title: "Database coordination",
                              detail: "Sammy, Emmanuel, you",
                              icon: ShieldAlert,
                              preview:
                                conflictDecision ||
                                "Keep the primary running while we drain.",
                              unread: !acknowledged.includes(
                                "Database coordination",
                              ),
                            },
                            {
                              title: "Payment verification",
                              detail: "Emmanuel to you",
                              icon: MessageSquare,
                              preview:
                                "Can you check a payment at the merch stand?",
                              unread: !paymentAcknowledged,
                            },
                            {
                              title: "Incident broadcast",
                              detail: "All responders",
                              icon: Radio,
                              preview: "Check-in canary is being rolled back.",
                              unread: false,
                            },
                          ].map((thread) => (
                            <button
                              className={`cm-thread${selectedThread === thread.title ? " is-selected" : ""}`}
                              key={thread.title}
                              aria-pressed={selectedThread === thread.title}
                              onClick={() => chooseThread(thread.title)}
                            >
                              <span className="cm-thread-icon">
                                <thread.icon size={17} />
                              </span>
                              <span>
                                <strong>
                                  {thread.title}
                                  {thread.unread && <i />}
                                </strong>
                                <small>{thread.detail}</small>
                                <p>{thread.preview}</p>
                              </span>
                            </button>
                          ))}
                          <div className="cm-thread-note">
                            <CircleHelp size={15} />
                            <p>
                              Agent briefed means context reached the agent.
                              Human acknowledgement is a separate action.
                            </p>
                          </div>
                        </aside>
                        <section className="cm-conversation">
                          <div className="cm-conversation-header">
                            <div>
                              <h2>{selectedThread}</h2>
                              <span>
                                INC-2041 <span className="cm-mid-dot">/</span>{" "}
                                Shared incident context
                              </span>
                            </div>
                            <Badge tone="info">
                              <Users size={12} />
                              {selectedThread === "Payment verification"
                                ? "2 people"
                                : "3 people"}
                            </Badge>
                          </div>
                          <div className="cm-message-history">
                            <div className="cm-date-divider">
                              <span />
                              TODAY, 14:44
                              <span />
                            </div>
                            <div className="cm-message">
                              <Avatar name="Emmanuel Bakare" />
                              <div>
                                <div className="cm-message-byline">
                                  <strong>Emmanuel</strong>
                                  <span>Registration</span>
                                  <time>14:44</time>
                                </div>
                                <div className="cm-message-bubble">
                                  {selectedThread === "Payment verification"
                                    ? "Jubril, can you verify a card payment at the merch stand? Errors look normal again, but I want a real check before we close."
                                    : selectedThread === "Incident broadcast"
                                      ? "I am aborting check-in canary v1.8. Please hold changes to confdb until connections have drained. I will post when the rollback is complete."
                                      : "I am aborting the check-in canary now. Sammy, please keep the database primary running while the connections drain."}
                                </div>
                                <div className="cm-route-receipt">
                                  <GitBranch size={13} />
                                  <span>Routed through CaptainMorgue</span>
                                  <button
                                    onClick={() =>
                                      setInspector({
                                        id: "route",
                                        actor: "CaptainMorgue",
                                        kind: "Routing reason",
                                        text:
                                          selectedThread ===
                                          "Payment verification"
                                            ? "Emmanuel directly asked Jubril to verify payments because Jubril owns the downstream Ticketing experience."
                                            : selectedThread ===
                                                "Incident broadcast"
                                              ? "This update was explicitly addressed to all responders in the incident."
                                              : "Sammy owns confdb. Emmanuel is rolling back check-in, which holds its connections. Jubril is verifying the downstream payment flow.",
                                        time: "14:44",
                                        tone: "info",
                                      })
                                    }
                                  >
                                    Why these people?
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="cm-route-status">
                              {selectedThread !== "Payment verification" && (
                                <div>
                                  <span className="cm-tiny-avatar">S</span>
                                  <strong>Sammy</strong>
                                  <span>Agent briefed</span>
                                  <CheckCheck size={14} />
                                </div>
                              )}
                              <div>
                                <span className="cm-tiny-avatar">J</span>
                                <strong>You</strong>
                                <span>
                                  {ack
                                    ? "Acknowledged by Jubril"
                                    : "Awaiting acknowledgement"}
                                </span>
                                {ack ? (
                                  <Check size={14} />
                                ) : (
                                  <Button
                                    disabled={isStale || wall}
                                    onClick={() => {
                                      if (isStale || wall) return;
                                      setAcknowledged((current) => [
                                        ...current,
                                        selectedThread,
                                      ]);
                                      addEvent(
                                        `Acknowledged ${selectedThread}`,
                                        "Acknowledgement",
                                      );
                                    }}
                                  >
                                    Acknowledge
                                  </Button>
                                )}
                              </div>
                            </div>
                            {selectedThread === "Database coordination" && (
                              <div className="cm-message">
                                <Avatar name="Sammy" />
                                <div>
                                  <div className="cm-message-byline">
                                    <strong>Sammy</strong>
                                    <span>Platform</span>
                                    <time>14:45</time>
                                  </div>
                                  <div className="cm-message-bubble">
                                    Understood. I have not restarted the
                                    primary. Connections are down to 58 now; I
                                    will keep watching.
                                  </div>
                                  <Receipt>
                                    Sammy explicitly acknowledged at 14:45
                                  </Receipt>
                                </div>
                              </div>
                            )}
                            {sent
                              .filter(
                                (message) => message.thread === selectedThread,
                              )
                              .map((message, index) => (
                                <div
                                  key={index}
                                  className="cm-message cm-message-own"
                                >
                                  <Avatar name="Jubril Oyetunji" />
                                  <div>
                                    <div className="cm-message-byline">
                                      <strong>You</strong>
                                      <span>To {message.scope}</span>
                                      <time>Now</time>
                                    </div>
                                    <div className="cm-message-bubble">
                                      {message.text}
                                    </div>
                                    <span className="cm-receipt">
                                      Local preview message / not delivered
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                          {!wall && (
                            <div className="cm-composer">
                              <label className="cm-compose-scope">
                                Send to{" "}
                                <select
                                  aria-label="Message recipients"
                                  value={scope}
                                  onChange={(event) =>
                                    setScope(event.target.value)
                                  }
                                >
                                  <option>Platform team</option>
                                  <option>Registration team</option>
                                  <option>Emmanuel</option>
                                  <option>Sammy</option>
                                  <option>All responders</option>
                                </select>
                              </label>
                              <textarea
                                aria-label="Message"
                                value={draft}
                                onChange={(event) =>
                                  setDraft(event.target.value)
                                }
                                placeholder="Share what you know. Ask for what you need."
                                rows={3}
                              />
                              <div className="cm-composer-footer">
                                <span>
                                  <Command size={13} />
                                  Messages stay in the incident record
                                </span>
                                <Button
                                  tone="amber"
                                  onClick={send}
                                  disabled={!draft.trim() || isStale}
                                >
                                  <Send size={14} />
                                  Send message
                                </Button>
                              </div>
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                    {view === "crew" && (
                      <>
                        <div className="cm-crew-overview">
                          <div>
                            <strong>3</strong>
                            <span>Responders</span>
                          </div>
                          <div>
                            <strong>3</strong>
                            <span>Teams involved</span>
                          </div>
                          <div>
                            <strong>{openParts.length}</strong>
                            <span>Open parts</span>
                          </div>
                          <div className="cm-crew-overview-note">
                            <Ship size={23} />
                            <p>
                              CaptainMorgue coordinates the crew.
                              <br />
                              <span>
                                Every action still has a person behind it.
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="cm-crew-cards">
                          {crew.map((person) => (
                            <article className="cm-crew-card" key={person.name}>
                              <div className="cm-crew-team">
                                <span>{person.team.toUpperCase()}</span>
                                <Badge tone="neutral">1 responder</Badge>
                              </div>
                              <div className="cm-crew-person">
                                <Avatar name={person.name} />
                                <div>
                                  <h2>
                                    {person.name}
                                    {person.name === "Jubril" && (
                                      <span>you</span>
                                    )}
                                  </h2>
                                  <p>{person.role}</p>
                                </div>
                              </div>
                              <div className="cm-crew-presence">
                                <Badge
                                  tone={
                                    person.state === "Working"
                                      ? "amber"
                                      : "success"
                                  }
                                  dot
                                >
                                  {person.state}
                                </Badge>
                                <span>{person.time}</span>
                              </div>
                              <p className="cm-crew-job">{person.job}</p>
                              <div className="cm-person-connections">
                                <div>
                                  <span>Browser</span>
                                  <span>Preview session</span>
                                </div>
                                <div>
                                  <span>Agent</span>
                                  <span className="cm-text-success">
                                    Connected in sample
                                  </span>
                                </div>
                              </div>
                              <div className="cm-crew-card-footer">
                                <span>
                                  <Layers3 size={14} />
                                  {person.team === "Registration"
                                    ? "checkin"
                                    : person.team === "Platform"
                                      ? "confdb"
                                      : "payments"}
                                </span>
                                <Button
                                  onClick={() => {
                                    setScope(
                                      person.name === "Jubril"
                                        ? "All responders"
                                        : person.name,
                                    );
                                    navigate("messages");
                                  }}
                                >
                                  <MessageSquare size={14} />
                                  Message
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="cm-crew-bottom">
                          <div>
                            <h2>Clear ownership keeps work moving.</h2>
                            <p>
                              All responders can claim, resolve, and close in
                              this hackathon preview. Changes are recorded
                              locally.
                            </p>
                          </div>
                          <Button onClick={() => navigate("incident")}>
                            Review open parts <ArrowRight size={15} />
                          </Button>
                        </div>
                      </>
                    )}
                    {view === "record" && (
                      <div className="cm-record-layout">
                        <article className="cm-record-paper">
                          <div className="cm-record-top">
                            <div>
                              <span className="cm-eyebrow">
                                INCIDENT RECORD / INC-2041
                              </span>
                              <h2>
                                Check-in kiosks failing
                                <br />
                                at Hall B
                              </h2>
                            </div>
                            <div
                              className={`cm-record-stamp${resolved ? " is-closed" : ""}`}
                            >
                              <Ship size={22} />
                              <strong>
                                {resolved ? "CLOSED" : "IN PROGRESS"}
                              </strong>
                              <span>
                                {resolved
                                  ? "14:51 / SAMPLE"
                                  : "LIVE DRAFT / SAMPLE"}
                              </span>
                            </div>
                          </div>
                          <p className="cm-record-lede">
                            A new attendee lookup exhausted the shared database
                            connection pool, slowing check-in and interrupting
                            card payments.
                          </p>
                          <div className="cm-record-facts">
                            <div>
                              <span>Opened</span>
                              <b>14:41</b>
                            </div>
                            <div>
                              <span>{resolved ? "Resolved" : "Status"}</span>
                              <b>{resolved ? "14:51" : "Active"}</b>
                            </div>
                            <div>
                              <span>Responders</span>
                              <b>3</b>
                            </div>
                            <div>
                              <span>Teams</span>
                              <b>3</b>
                            </div>
                          </div>
                          <section className="cm-record-section">
                            <span className="cm-section-number">01</span>
                            <div>
                              <h3>What happened</h3>
                              <p>
                                Check-in v1.8 introduced a lookup on badge email
                                without an index. Each request scanned 48,000
                                attendee rows and held a database connection.
                                Payments shared the same pool and began timing
                                out.
                              </p>
                              <button
                                className="cm-evidence-link"
                                onClick={() => setInspector(starterEvents[0])}
                              >
                                <Link2 size={13} />
                                Radar investigation / 14:46
                                <ArrowUpRight size={12} />
                              </button>
                            </div>
                          </section>
                          <section className="cm-record-section">
                            <span className="cm-section-number">02</span>
                            <div>
                              <h3>
                                {resolved
                                  ? "How the crew resolved it"
                                  : "The response so far"}
                              </h3>
                              <div className="cm-record-step">
                                <span>14:44</span>
                                <p>
                                  <b>Emmanuel aborted the check-in canary.</b>{" "}
                                  Previous version v1.7 restored while the crew
                                  investigated.
                                </p>
                              </div>
                              <div className="cm-record-step">
                                <span>14:45</span>
                                <p>
                                  <b>Sammy held the database restart.</b>{" "}
                                  Coordination preserved the sessions draining
                                  during rollback.
                                </p>
                              </div>
                              <div className="cm-record-step">
                                <span>14:46</span>
                                <p>
                                  <b>Database pressure eased.</b> Payment errors
                                  returned to 0.3%. The crew requested a real
                                  payment verification.
                                </p>
                              </div>
                              {resolved && (
                                <div className="cm-record-step">
                                  <span>14:51</span>
                                  <p>
                                    <b>The sample incident was closed.</b> This
                                    is a design example, not a production
                                    incident record.
                                  </p>
                                </div>
                              )}
                            </div>
                          </section>
                          <section className="cm-record-section">
                            <span className="cm-section-number">03</span>
                            <div>
                              <h3>Keep it from coming back</h3>
                              <div className="cm-improvement">
                                <span className="cm-checkbox" />
                                <div>
                                  <b>Check query plans for new lookups in CI</b>
                                  <small>Registration / Emmanuel</small>
                                </div>
                                <Badge tone="neutral">Proposed</Badge>
                              </div>
                              <div className="cm-improvement">
                                <span className="cm-checkbox" />
                                <div>
                                  <b>
                                    Separate check-in and payment connection
                                    pools
                                  </b>
                                  <small>Platform / Sammy</small>
                                </div>
                                <Badge tone="neutral">Proposed</Badge>
                              </div>
                            </div>
                          </section>
                          <footer className="cm-record-footer">
                            <Ship size={16} />
                            Written from the timeline. Kept for the next crew.
                          </footer>
                        </article>
                        <aside className="cm-record-aside">
                          <Panel title="A familiar pattern">
                            <span className="cm-match-id">
                              PAST INCIDENT / INC-1877
                            </span>
                            <h3>Same query. Last year's conference.</h3>
                            <p>
                              Slow check-in after a release. An index restored
                              service, but no query-plan check followed.
                            </p>
                            <div className="cm-record-aside-rule" />
                            <span className="cm-eyebrow">THE LESSON</span>
                            <p>
                              Fix the query, then make the missing check part of
                              the release.
                            </p>
                            <span className="cm-sample-caption">
                              Illustrative past incident
                            </span>
                          </Panel>
                          <div className="cm-inline-note">
                            <FileText size={19} />
                            <p>
                              {resolved
                                ? "This sample record is ready to review."
                                : "The record is a draft while the incident is active."}{" "}
                              Source events and evidence remain inspectable.
                            </p>
                          </div>
                        </aside>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
          {inspector && (
            <aside className="cm-inspector" aria-label="Evidence inspector">
              <div className="cm-inspector-header">
                <span className="cm-eyebrow">INCIDENT CONTEXT</span>
                <Button
                  aria-label="Close inspector"
                  onClick={() => setInspector(null)}
                >
                  <X size={16} />
                </Button>
              </div>
              <Badge tone={inspector.tone}>{inspector.kind}</Badge>
              <h2>{inspector.evidence || inspector.kind}</h2>
              <div className="cm-inspector-byline">
                <Avatar small name={inspector.actor} />
                <span>{inspector.actor}</span>
                <time>{inspector.time}</time>
              </div>
              <p className="cm-inspector-summary">{inspector.text}</p>
              <div className="cm-inspector-block">
                <span className="cm-eyebrow">AFFECTED RESOURCE</span>
                <code>
                  {inspector.actor === "Radar"
                    ? "deployment/checkin"
                    : "cluster/confdb"}
                </code>
                <small>team-captainmorgue</small>
              </div>
              {inspector.actor === "Radar" && (
                <div className="cm-inspector-block">
                  <span className="cm-eyebrow">SAMPLE EVIDENCE</span>
                  <pre>
                    {
                      "Seq Scan on attendees\n  Filter: badge_email = $1\n  Rows scanned: 48,000\n  Duration: 3,042 ms"
                    }
                  </pre>
                  <p>
                    The lookup has no matching index. The database connection
                    stays occupied for the duration of the scan.
                  </p>
                </div>
              )}
              <div className="cm-inspector-block">
                <span className="cm-eyebrow">WHAT THIS MEANS</span>
                <p>
                  Coordinate changes to check-in and confdb. Verify recovery
                  before resolving the affected parts.
                </p>
              </div>
              <Button
                onClick={() => {
                  setScope("All responders");
                  if (!draft.trim())
                    setDraft(
                      `Regarding ${inspector.evidence || inspector.kind}: `,
                    );
                  navigate("messages");
                }}
              >
                <MessageSquare size={15} />
                Discuss with the crew
              </Button>
              <p className="cm-inspector-disclaimer">
                Sample evidence for design review. No external investigation is
                opened.
              </p>
            </aside>
          )}
        </div>
      </div>
      {toast && (
        <div className="cm-toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {dialog && (
        <Dialog
          title={
            dialog.kind === "resolve"
              ? `Resolve ${parts.find((part) => part.id === dialog.part)?.title}`
              : dialog.kind === "close"
                ? "Close this incident"
                : dialog.kind === "declare"
                  ? "Declare a sample incident"
                  : "Coordinate the database changes"
          }
          onClose={closeDialog}
        >
          <div className="cm-modal-body">
            {dialog.kind === "decision" && (
              <>
                <div className="cm-conflict-comparison">
                  <div>
                    <span>EMMANUEL / REGISTRATION</span>
                    <strong>Abort check-in canary</strong>
                    <p>Existing requests are draining.</p>
                  </div>
                  <div>
                    <span>SAMMY / PLATFORM</span>
                    <strong>Restart confdb primary</strong>
                    <p>Would interrupt active connections.</p>
                  </div>
                </div>
                <div className="cm-inline-note">
                  <ShieldAlert size={17} />
                  <p>
                    Recording a decision informs the crew. It does not stop or
                    execute any command.
                  </p>
                </div>
              </>
            )}
            {dialog.kind === "close" && (
              <>
                <p className="cm-modal-description">
                  Review the incident before closing. Every responder can close
                  in this demo.
                </p>
                <div
                  className={`cm-close-check ${openParts.length ? "has-open" : ""}`}
                >
                  <Layers3 size={18} />
                  <span>
                    {openParts.length
                      ? `${openParts.length} parts still open. Resolve them before closing.`
                      : "All incident parts are resolved."}
                  </span>
                </div>
              </>
            )}
            <label className="cm-field">
              {dialog.kind === "resolve"
                ? "How was this resolved?"
                : dialog.kind === "close"
                  ? "Resolution summary"
                  : dialog.kind === "declare"
                    ? "What is happening?"
                    : "Decision and next step"}
              <textarea
                autoFocus
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  dialog.kind === "decision"
                    ? "Hold the database restart until the canary abort completes..."
                    : "Describe what changed and the evidence behind it..."
                }
              />
            </label>
            <p className="cm-form-hint">
              Recorded as Jubril / Ticketing. This action only changes the local
              design preview.
            </p>
            <div className="cm-modal-actions">
              <Button onClick={closeDialog}>Cancel</Button>
              <Button
                tone={dialog.kind === "close" ? "success" : "amber"}
                disabled={
                  !reason.trim() ||
                  isStale ||
                  wall ||
                  (dialog.kind === "close" && openParts.length > 0)
                }
                onClick={submitDialog}
              >
                {dialog.kind === "close"
                  ? "Confirm close"
                  : dialog.kind === "resolve"
                    ? "Record resolution"
                    : dialog.kind === "declare"
                      ? "Declare incident"
                      : "Record decision"}
                <Check size={15} />
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function Foundations() {
  const colors = [
    { name: "Warm ivory", hex: "#F6F1E7", use: "Workspace" },
    { name: "Label paper", hex: "#FFFDF7", use: "Raised surface" },
    { name: "Bottle ink", hex: "#241D18", use: "Navigation and text" },
    { name: "Rum amber", hex: "#A65E20", use: "Primary action" },
    { name: "Antique brass", hex: "#A3874B", use: "Brand detail" },
    { name: "Label red", hex: "#A33935", use: "Urgent attention" },
    { name: "Recovery green", hex: "#397255", use: "Resolved" },
    { name: "Evidence blue", hex: "#426A80", use: "Information" },
  ];
  return (
    <div className="cm-foundations">
      <header>
        <span className="cm-eyebrow">CAPTAINMORGUE / DESIGN FOUNDATIONS</span>
        <div className="cm-foundations-brand">
          A little spirit.
          <br />A clear head.
        </div>
        <p>
          Ivory paper, bottle ink, amber and brass. A restrained incident
          workspace with warmth, character, and room to think.
        </p>
        <Badge tone="neutral">Hackathon library / 01</Badge>
      </header>
      <section>
        <div className="cm-foundation-heading">
          <span>01</span>
          <h2>From the bottle to the workspace</h2>
        </div>
        <div className="cm-swatches">
          {colors.map((color) => (
            <div key={color.name}>
              <div style={{ background: color.hex }} />
              <strong>{color.name}</strong>
              <code>{color.hex}</code>
              <small>{color.use}</small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="cm-foundation-heading">
          <span>02</span>
          <h2>Quiet foundations. Clear signals.</h2>
        </div>
        <div className="cm-foundation-specimens">
          <Panel title="Actions">
            <div className="cm-specimen-row">
              <Button tone="amber">
                Send message <Send size={14} />
              </Button>
              <Button>
                Inspect evidence <ArrowUpRight size={14} />
              </Button>
              <Button tone="danger">Close incident</Button>
              <Button disabled>Waiting for response</Button>
            </div>
          </Panel>
          <Panel title="Status, always with a name">
            <div className="cm-specimen-row">
              <Badge tone="danger" dot>
                Conflict
              </Badge>
              <Badge tone="amber" dot>
                Investigating
              </Badge>
              <Badge tone="success" dot>
                Resolved
              </Badge>
              <Badge tone="info">Evidence</Badge>
              <Badge>Agent offline</Badge>
            </div>
          </Panel>
          <Panel title="People and presence">
            <div className="cm-specimen-row">
              <Avatar name="Jubril Oyetunji" />
              <div>
                <strong>Jubril Oyetunji</strong>
                <p className="cm-subtitle">Ticketing / Responder</p>
              </div>
              <Badge tone="success" dot>
                Available
              </Badge>
            </div>
          </Panel>
          <Panel title="Inputs">
            <label className="cm-field">
              A message to the crew
              <textarea
                placeholder="Share what you know. Ask for what you need."
                rows={2}
              />
            </label>
          </Panel>
        </div>
      </section>
      <section>
        <div className="cm-foundation-heading">
          <span>03</span>
          <h2>One type system. Three jobs.</h2>
        </div>
        <div className="cm-type-specimen">
          <div>
            <span>BRAND / GEORGIA</span>
            <strong className="cm-serif-sample">CaptainMorgue</strong>
          </div>
          <div>
            <span>INTERFACE / SYSTEM SANS</span>
            <strong>Every action has a person behind it.</strong>
          </div>
          <div>
            <span>EVIDENCE / MONOSPACE</span>
            <code>14:44:20 / deployment/checkin / INC-2041</code>
          </div>
        </div>
      </section>
      <footer>Warmth in the foundation. Urgency only where it belongs.</footer>
    </div>
  );
}
