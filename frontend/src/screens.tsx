import { useCallback, useState } from "react";
import {
  Activity,
  Bot,
  Pencil,
  RotateCcw,
  Terminal,
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
  Diamond,
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
  ProgressStatus,
  plural,
} from "./ui";
import { SidePanel } from "./side-panel";
import { ResponseTimeline } from "./response-timeline";
import { Postmortems } from "./postmortems";
import { SAMPLE_POSTMORTEMS } from "./postmortems-fixtures";
import "./tokens.css";
import tokenSource from "./tokens.css?raw";
import "./styles.css";
import "./agent-conversations.css";

type View = "incident" | "messages" | "crew" | "record" | "join" | "postmortems";
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
type CoordinationStatus =
  "approval" | "input" | "working" | "answered" | "escalated";
const coordinationThreads = [
  {
    title: "Payment verification",
    owner: "Jubril",
    sender: "Emmanuel",
    recipient: "Emmanuel",
    status: "approval" as CoordinationStatus,
    resource: "service/payments",
    ask: "Can you confirm payments are recovering before we close the incident?",
    why: "Jubril owns Ticketing. His agent can inspect payment telemetry without interrupting the check-in rollback.",
    task: "Compare payment errors before and after the rollback",
    finding:
      "Payment errors fell from 9.1% to 0.3%. All sampled failures occurred before the rollback completed.",
    proposal:
      "Payment errors are back to 0.3% and the recent traces are clear. I still need a real card payment at the merch stand before confirming end-to-end recovery.",
    evidence: "Payment recovery traces",
    seq: 42,
  },
  {
    title: "Database coordination",
    owner: "Jubril",
    sender: "Sammy",
    recipient: "Sammy",
    status: "input" as CoordinationStatus,
    resource: "cluster/confdb",
    ask: "Are you still seeing payment failures? I need to know before changing the database primary.",
    why: "Sammy is watching confdb. Jubril can confirm whether Ticketing still sees user impact.",
    task: "Check whether card payments are still failing at the venue",
    finding:
      "Telemetry is recovering, but the agent cannot verify a physical payment at the merch stand.",
    proposal:
      "Telemetry is improving. Please keep the primary running while we verify a real payment at the merch stand.",
    evidence: "Shared database dependency",
    seq: 45,
  },
  {
    title: "Connection recovery",
    owner: "Sammy",
    sender: "Emmanuel",
    recipient: "Sammy",
    status: "working" as CoordinationStatus,
    resource: "cluster/confdb",
    ask: "Check whether the pool is draining after the canary abort.",
    why: "Sammy owns Platform and has the database investigation context.",
    task: "Inspect connection counts and active queries through Radar",
    finding:
      "Connections have fallen from 96 to 58. The agent is checking the remaining long-running queries.",
    proposal:
      "The pool is draining: 58 of 100 connections are active, down from 96. Keep watching until the remaining check-in queries finish.",
    evidence: "Database connection snapshot",
    seq: 38,
  },
  {
    title: "Canary rollback",
    owner: "Emmanuel",
    sender: "Sammy",
    recipient: "Sammy",
    status: "answered" as CoordinationStatus,
    resource: "rollout/checkin",
    ask: "Has the check-in canary finished rolling back?",
    why: "Emmanuel owns the rollout and can confirm the serving revision.",
    task: "Read rollout status through Radar",
    finding:
      "Version v1.7 is serving all traffic. The canary is fully aborted.",
    proposal:
      "Confirmed: the canary is aborted and v1.7 is serving 100% of traffic. No additional rollout changes are in progress.",
    evidence: "Rollout status",
    seq: 35,
  },
  {
    title: "Platform handoff",
    owner: "Sammy",
    sender: "Jubril",
    recipient: "Sammy",
    status: "escalated" as CoordinationStatus,
    resource: "cluster/confdb",
    ask: "Who can verify the remaining database connections?",
    why: "The ask did not reach Sammy's agent context before the timeout. CaptainMorgue posted status and escalated it.",
    task: "Awaiting the next agent context update",
    finding:
      "Latest activity: Sammy was inspecting active database queries at 14:45.",
    proposal:
      "I am checking the remaining queries and will send the connection breakdown shortly.",
    evidence: "Latest agent activity",
    seq: 47,
  },
];
const coordinationLabels: Record<CoordinationStatus, string> = {
  approval: "Awaiting approval",
  input: "Needs your input",
  working: "Agent working",
  answered: "Answered",
  escalated: "Escalated / no answer",
};
const coordinationTones = {
  approval: "amber",
  input: "danger",
  working: "info",
  answered: "success",
  escalated: "amber",
} as const;
const nav: {
  id: View;
  label: string;
  icon: typeof Activity;
  count?: string;
}[] = [
  { id: "incident", label: "Incident", icon: Activity },
  { id: "messages", label: "Requests", icon: Bot, count: "2" },
  { id: "crew", label: "Crew", icon: Users },
  { id: "record", label: "Record", icon: BookOpen },
  { id: "postmortems", label: "Postmortems", icon: FileText },
];

export function CaptainWorkspace({
  initialView = "incident",
  scenario = "active",
  wallMode = false,
  initialConversation = "Payment verification",
}: {
  initialView?: View;
  scenario?: Scenario;
  wallMode?: boolean;
  initialConversation?:
    | "Payment verification"
    | "Database coordination"
    | "Connection recovery"
    | "Canary rollback"
    | "Platform handoff";
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
  const [scopes, setScopes] = useState<Record<string, string>>({
    "Database coordination": "Platform team",
    "Payment verification": "Emmanuel",
    "Platform handoff": "Sammy",
    "Connection recovery": "Sammy",
    "Canary rollback": "Sammy",
  });
  const [sent, setSent] = useState<
    { text: string; scope: string; thread: string; kind?: "ask" | "reply" }[]
  >([]);
  const [dialog, setDialog] = useState<{
    kind: "resolve" | "close" | "decision" | "declare";
    part?: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("Decisions");
  const [selectedThread, setSelectedThread] =
    useState<string>(initialConversation);
  const [threadStatuses, setThreadStatuses] = useState<
    Record<string, CoordinationStatus>
  >(
    Object.fromEntries(
      coordinationThreads.map((thread) => [thread.title, thread.status]),
    ),
  );
  const [proposals, setProposals] = useState<Record<string, string>>(
    Object.fromEntries(
      coordinationThreads.map((thread) => [thread.title, thread.proposal]),
    ),
  );
  const [editingProposal, setEditingProposal] = useState<string | null>(null);
  const [feedbackThread, setFeedbackThread] = useState<string | null>(null);
  const [agentFeedback, setAgentFeedback] = useState<Record<string, string>>(
    {},
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const currentThread =
    coordinationThreads.find((thread) => thread.title === selectedThread) ??
    coordinationThreads[0];
  const threadStatus = threadStatuses[currentThread.title];
  const approvedPayment = threadStatuses["Payment verification"] === "answered";
  const draft = drafts[selectedThread] ?? "";
  const scope = scopes[selectedThread] ?? currentThread.recipient;
  function setScope(value: string) {
    setScopes((current) => ({ ...current, [selectedThread]: value }));
  }
  function setDraft(value: string) {
    setDrafts((current) => ({ ...current, [selectedThread]: value }));
  }
  const ack = acknowledged.includes(selectedThread);

  const unreadRequests = Object.values(threadStatuses).filter(
    (status) => status === "approval" || status === "input",
  ).length;
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
  }
  function openComposer(thread: string, recipient: string, prefill = "") {
    if (drafts[thread]?.trim()) {
      notify("Your existing draft and its recipients have been kept.");
    } else {
      setScopes((current) => ({ ...current, [thread]: recipient }));
      setDrafts((current) => ({ ...current, [thread]: prefill }));
    }
    chooseThread(thread);
    setComposerOpen(true);
    navigate("messages");
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
      { text: draft.trim(), scope, thread: selectedThread, kind: "ask" },
    ]);
    addEvent(
      `Asked through Jubril's agent, to ${scope}: ${draft.trim()}`,
      "Agent ask",
    );
    setDraft("");
    notify(
      "Ask queued through your agent in this preview. No real message was sent.",
    );
  }
  function approveReply() {
    if (isStale || wall || !proposals[selectedThread]?.trim()) return;
    const text = proposals[selectedThread].trim();
    setSent((current) => [
      ...current,
      {
        text,
        scope: currentThread.sender,
        thread: selectedThread,
        kind: "reply",
      },
    ]);
    setThreadStatuses((current) => ({
      ...current,
      [selectedThread]: "answered",
    }));
    setEditingProposal(null);
    addEvent(
      `Approved reply to ${currentThread.sender}'s ask #${currentThread.seq}: ${text}`,
      "Decision",
    );
    notify(
      "Reply approved by Jubril and routed in the sample timeline. No real message was sent.",
    );
  }
  function returnToAgent() {
    if (isStale || wall || !agentFeedback[selectedThread]?.trim()) return;
    setThreadStatuses((current) => ({
      ...current,
      [selectedThread]: "working",
    }));
    addEvent(
      `Returned ${selectedThread} to ${currentThread.owner}'s agent: ${agentFeedback[selectedThread]}`,
      "Agent instruction",
    );
    setFeedbackThread(null);
    setEditingProposal(null);
    notify(
      "Feedback saved locally. The sample agent is working; no reply was sent.",
    );
  }
  function acknowledgeThread() {
    if (isStale || wall || ack) return;
    setAcknowledged((current) => [...current, selectedThread]);
    addEvent(
      `Human acknowledgement of ask #${currentThread.seq}. An answer is still required.`,
      "Acknowledgement",
    );
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
      filter === "All" ||
      (filter === "Decisions"
        ? event.kind === "Decision"
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
              CaptainMorgue<small>Where incidents go to die</small>
            </span>
          </a>
          <div className="cm-workspace-switch">
            <span className="cm-workspace-icon">CN</span>
            <span>
              Cloud Native Hackathon<small>Conference operations</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <div className="cm-nav-label">Workspace</div>
          <nav aria-label="Workspace">
            {nav.map((item) => (
              <button
                key={item.id}
                className={`cm-nav-item${view === item.id ? " is-active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={16} strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.count && unreadRequests > 0 && (
                  <span className="cm-nav-count">{unreadRequests}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="cm-sidebar-incident">
            <span className="cm-nav-label">On the desk</span>
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
            <span className="cm-breadcrumb-context">Conference operations</span>
            <ChevronRight size={13} />
            <span>
              {view === "join"
                ? "Join the incident"
                : nav.find((item) => item.id === view)?.label}
            </span>
          </div>
          <div className="cm-topbar-right">
            <span className="cm-preview-top">Design preview</span>
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
                  <span className="cm-eyebrow">A shared incident desk</span>
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
                {view !== "postmortems" && (<div className="cm-page-title">
                  <div>
                    <h1>
                      {view === "incident"
                        ? isEmpty
                          ? "The incident desk"
                          : "Check-in kiosks failing at Hall B"
                        : view === "messages"
                          ? "Requests"
                          : view === "crew"
                            ? "Crew"
                            : "Record"}
                    </h1>
                    <p>
                      {view === "incident"
                        ? isEmpty
                          ? "Your crew is ready when something needs attention."
                          : "Attendees are waiting at check-in. Card payments at the merch stand are also affected."
                        : view === "messages"
                          ? "Review replies and unblock your agents."
                          : view === "crew"
                            ? "Responders, agents and assignments."
                            : "Decisions, evidence and resolution."}
                    </p>
                  </div>
                  {view === "incident" && !isEmpty && (
                    <div className="cm-page-action">
                      <Badge tone={resolved ? "success" : "danger"} dot>
                        {resolved ? "Resolved" : "SEV 1 / Active"}
                      </Badge>
                      {!wall && (
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
                      )}
                    </div>
                  )}
                  {view === "record" && (
                    <Button onClick={copyRecord}>
                      <Copy size={15} />
                      Copy summary
                    </Button>
                  )}
                </div>
                )}
                {isEmpty && view !== "postmortems" ? (
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
                        <section className="cm-kpi-row" aria-label="Incident overview">
                          <div className="cm-stat-card">
                            <span>{plural(openParts.length, "Open part", "Open parts")}</span>
                            <strong>{openParts.length}</strong>
                            <small>INC-2041</small>
                          </div>
                          <div className="cm-stat-card">
                            <span>{plural(crew.length, "Person online", "People online")}</span>
                            <strong>{crew.length}</strong>
                            <small>3 teams / {crew.length} {plural(crew.length, "responder", "responders")}</small>
                          </div>
                          <div className="cm-stat-card">
                            <span>{plural(unreadRequests, "Open ask", "Open asks")}</span>
                            <strong>{unreadRequests}</strong>
                            <small>Needs your attention</small>
                          </div>
                          <div className="cm-stat-card">
                            <span>{plural(resolved || conflictDecision ? 0 : 1, "Conflict", "Conflicts")}</span>
                            <strong>{resolved || conflictDecision ? 0 : 1}</strong>
                            <small>
                              {resolved || conflictDecision ? "Coordinated" : "Decision needed"}
                            </small>
                          </div>
                          <div className="cm-stat-card">
                            <span>Elapsed</span>
                            <strong>{resolved ? "00:10:00" : "00:14:20"}</strong>
                            <small>Opened 14:41</small>
                          </div>
                        </section>
                        {resolved ? (
                          <div className="cm-resolved-banner">
                            <span className="cm-toe-tag">
                              <CheckCheck size={14} aria-hidden="true" />
                              Resolved
                            </span>
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
                              <span>Needs attention</span>
                              <span className="cm-count">
                                {(conflictDecision ? 0 : 1) +
                                  (approvedPayment ? 0 : 1)}
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
                                    <Diamond size={20} />
                                  )}
                                </span>
                                <div className="cm-attention-content">
                                  <div className="cm-attention-kicker">
                                    {conflictDecision
                                      ? "Coordination decision recorded"
                                      : "Conflict / confdb"}
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
                                    {approvedPayment
                                      ? "Reply approved by you"
                                      : "Your agent / awaiting approval"}
                                  </div>
                                  <h2>
                                    {approvedPayment
                                      ? "Your agent has answered Emmanuel."
                                      : "Your agent has a reply ready."}
                                  </h2>
                                  <p>
                                    Your agent checked payment telemetry for
                                    Emmanuel. Review its evidence and approve
                                    the reply before it goes back.
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
                                        Review proposed reply{" "}
                                        <ArrowUpRight size={14} />
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
                              <h2>Activity</h2>
                              <Badge tone="neutral">
                                <Radio size={12} />
                                Sample timeline
                              </Badge>
                            </div>
                            <div className="cm-agent-quiet-traffic">
                              <Bot size={16} />
                              <span>
                                Agents investigating across 3 teams
                              </span>
                            </div>
                            <div className="cm-feed-toolbar">
                              <div className="cm-filter-tabs">
                                {["All", "Decisions", "Evidence"].map(
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
                                      <Diamond size={17} />
                                    ) : event.kind === "Decision" ? (
                                      <GitBranch size={17} />
                                    ) : (
                                      <Activity size={17} />
                                    )}
                                  </div>
                                  <div className="cm-event-body">
                                    <div className="cm-event-heading">
                                      <strong>{event.actor}</strong>
                                      <span className="cm-event-kind">
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
                              title="Tasks"
                              action={
                                <span className="cm-mono cm-muted">
                                  {openParts.length} open {plural(openParts.length, "part", "parts")}
                                </span>
                              }
                            >
                              {parts.map((part) => (
                                <div className="cm-part" key={part.id}>
                                  <div className="cm-part-heading">
                                    <h3>{part.title}</h3>
                                    {part.done && (
                                      <span className="cm-toe-tag">
                                        <Badge tone="success">Resolved</Badge>
                                      </span>
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
                            <details className="cm-disclosure cm-signals-disclosure">
                              <summary>Signals</summary>
                            <Panel
                              title="Recovery signals"
                              action={
                                <span className="cm-sample-caption">
                                  Sample
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
                            </details>
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
                      <div className="cm-agent-workspace">
                        <aside
                          className="cm-agent-inbox"
                          aria-label="Coordination threads"
                        >
                          <div className="cm-agent-inbox-heading">
                            <h2>{plural(coordinationThreads.length, "Incident ask", "Incident asks")}</h2>
                            <span>{coordinationThreads.length}</span>
                          </div>
                          <div className="cm-agent-inbox-group">
                            Needs you <span>{unreadRequests}</span>
                          </div>
                          {coordinationThreads.map((thread) => (
                            <button
                              key={thread.title}
                              className={`cm-agent-thread${selectedThread === thread.title ? " is-selected" : ""}`}
                              aria-pressed={selectedThread === thread.title}
                              onClick={() => chooseThread(thread.title)}
                            >
                              <strong>{thread.title}</strong>
                              <span className="cm-agent-thread-owner">
                                {thread.owner}'s agent <span>/</span>{" "}
                                {thread.sender} asked
                              </span>
                              <Badge
                                tone={
                                  coordinationTones[
                                    threadStatuses[thread.title]
                                  ]
                                }
                                dot
                              >
                                {
                                  coordinationLabels[
                                    threadStatuses[thread.title]
                                  ]
                                }
                              </Badge>
                            </button>
                          ))}
                        </aside>
                        <section
                          className="cm-agent-detail"
                          aria-label="Selected coordination thread"
                        >
                          <header className="cm-agent-detail-heading">
                            <div>
                              <span className="cm-eyebrow">
                                ASK #{currentThread.seq} /{" "}
                                {currentThread.resource}
                              </span>
                              <h2>{currentThread.title}</h2>
                            </div>
                            <Badge tone={coordinationTones[threadStatus]} dot>
                              {coordinationLabels[threadStatus]}
                            </Badge>
                          </header>
                          <div className="cm-agent-detail-body">
                            <div className="cm-agent-original-ask">
                              <span className="cm-eyebrow">
                                The ask / 14:44
                              </span>
                              <p>{currentThread.ask}</p>
                              <button
                                className="cm-text-button"
                                onClick={() =>
                                  setInspector({
                                    id: "route",
                                    actor: "CaptainMorgue",
                                    kind: "Routing reason",
                                    text: currentThread.why,
                                    time: "14:44",
                                    tone: "info",
                                  })
                                }
                              >
                                <GitBranch size={13} />
                                Why this agent? <ArrowUpRight size={12} />
                              </button>
                            </div>
                            {threadStatus === "escalated" && (
                              <div className="cm-agent-escalation">
                                <div>
                                  <Clock3 size={18} />
                                  <strong>
                                    Automated status update. Not an answer.
                                  </strong>
                                </div>
                                <p>{currentThread.finding}</p>
                                <span>
                                  CaptainMorgue posted the last known activity
                                  and escalated the unanswered ask. A reply is
                                  still needed.
                                </span>
                                <Badge tone="amber">Ask remains open</Badge>
                              </div>
                            )}
                            {threadStatus === "working" && (
                              <div className="cm-agent-working">
                                <Bot size={23} />
                                <div>
                                  <ProgressStatus state="working">
                                    Agent is investigating
                                  </ProgressStatus>
                                  <p>
                                    {agentFeedback[selectedThread]
                                      ? `Your instruction: ${agentFeedback[selectedThread]}`
                                      : currentThread.finding}
                                  </p>
                                  <span>
                                    No answer has been sent. A proposed reply
                                    will appear here for review.
                                  </span>
                                  <Button
                                    disabled={isStale}
                                    onClick={() => {
                                      if (isStale) return;
                                      setThreadStatuses((current) => ({
                                        ...current,
                                        [selectedThread]: "approval",
                                      }));
                                      notify(
                                        "Showing the next sample finding. No tool was run.",
                                      );
                                    }}
                                  >
                                    Show sample proposed reply{" "}
                                    <ArrowRight size={13} />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {threadStatus === "input" && (
                              <div className="cm-agent-human-input">
                                <div className="cm-agent-proposal-label">
                                  <CircleHelp size={17} />
                                  <ProgressStatus state="waiting">
                                    A person needs to check this
                                  </ProgressStatus>
                                  <Badge tone="danger">
                                    For {currentThread.owner}
                                  </Badge>
                                </div>
                                <p>{currentThread.finding}</p>
                                <label className="cm-field">
                                  What should your agent know?
                                  <textarea
                                    rows={3}
                                    aria-label="Input for agent"
                                    value={agentFeedback[selectedThread] ?? ""}
                                    onChange={(event) =>
                                      setAgentFeedback((current) => ({
                                        ...current,
                                        [selectedThread]: event.target.value,
                                      }))
                                    }
                                    placeholder="Tell your agent what you observed at the merch stand..."
                                  />
                                </label>
                                <Button
                                  tone="amber"
                                  disabled={
                                    isStale ||
                                    !agentFeedback[selectedThread]?.trim()
                                  }
                                  onClick={returnToAgent}
                                >
                                  Give input to agent <ArrowRight size={14} />
                                </Button>
                              </div>
                            )}
                            {threadStatus === "approval" && (
                              <div className="cm-agent-proposal">
                                <div className="cm-agent-proposal-label">
                                  <Sparkles size={17} />
                                  <strong>Proposed reply</strong>
                                  <ProgressStatus state="waiting">
                                    Awaiting your approval
                                  </ProgressStatus>
                                </div>
                                <div className="cm-agent-proposal-to">
                                  From {currentThread.owner}'s agent{" "}
                                  <ArrowRight size={12} /> To{" "}
                                  {currentThread.sender}
                                </div>
                                {editingProposal === selectedThread ? (
                                  <label className="cm-field">
                                    Edit proposed reply
                                    <textarea
                                      aria-label="Proposed reply"
                                      rows={5}
                                      value={proposals[selectedThread]}
                                      onChange={(event) =>
                                        setProposals((current) => ({
                                          ...current,
                                          [selectedThread]: event.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                ) : (
                                  <p className="cm-agent-proposed-text">
                                    {proposals[selectedThread]}
                                  </p>
                                )}
                                <div className="cm-agent-review-note">
                                  <ShieldAlert size={13} />
                                  <span>
                                    Review before sending.
                                  </span>
                                </div>
                                {feedbackThread === selectedThread ? (
                                  <div className="cm-agent-return">
                                    <label className="cm-field">
                                      What should the agent investigate or
                                      change?
                                      <textarea
                                        aria-label="Feedback for agent"
                                        rows={3}
                                        value={
                                          agentFeedback[selectedThread] ?? ""
                                        }
                                        onChange={(event) =>
                                          setAgentFeedback((current) => ({
                                            ...current,
                                            [selectedThread]:
                                              event.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <div className="cm-agent-proposal-actions">
                                      <Button
                                        disabled={
                                          isStale ||
                                          !agentFeedback[selectedThread]?.trim()
                                        }
                                        onClick={returnToAgent}
                                      >
                                        <RotateCcw size={14} />
                                        Return with feedback
                                      </Button>
                                      <Button
                                        onClick={() => setFeedbackThread(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="cm-agent-proposal-actions">
                                    <Button
                                      tone="amber"
                                      onClick={approveReply}
                                      disabled={
                                        isStale ||
                                        !proposals[selectedThread]?.trim()
                                      }
                                    >
                                      <Check size={15} />
                                      Approve and send reply
                                    </Button>
                                    <Button
                                      disabled={isStale}
                                      onClick={() =>
                                        setEditingProposal(
                                          editingProposal === selectedThread
                                            ? null
                                            : selectedThread,
                                        )
                                      }
                                    >
                                      <Pencil size={14} />
                                      {editingProposal === selectedThread
                                        ? "Finish editing"
                                        : "Edit reply"}
                                    </Button>
                                    <Button
                                      disabled={isStale}
                                      onClick={() =>
                                        setFeedbackThread(selectedThread)
                                      }
                                    >
                                      <RotateCcw size={14} />
                                      Return to agent
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                            {threadStatus === "answered" && (
                              <div className="cm-agent-answer">
                                <div className="cm-agent-proposal-label">
                                  <CheckCheck size={18} />
                                  <ProgressStatus state="done">
                                    Human-approved answer
                                  </ProgressStatus>
                                  <Badge tone="success">Answered</Badge>
                                </div>
                                <p>
                                  {sent
                                    .filter(
                                      (message) =>
                                        message.thread === selectedThread &&
                                        message.kind === "reply",
                                    )
                                    .at(-1)?.text ?? currentThread.proposal}
                                </p>
                                <Receipt>
                                  {sent.some(
                                    (message) =>
                                      message.thread === selectedThread &&
                                      message.kind === "reply",
                                  )
                                    ? "Approved by Jubril / sample reply routed to " +
                                      currentThread.sender
                                    : "Approved by Emmanuel at 14:45 / sample reply routed to Sammy"}
                                </Receipt>
                              </div>
                            )}
                            <details className="cm-disclosure" key={`evidence-${selectedThread}`}>
                              <summary>Evidence</summary>
                            <div className="cm-agent-stage-heading">
                              <h3>
                                <Bot size={16} />
                                {currentThread.owner}'s agent
                              </h3>
                              <span>Claude Code / investigation worker</span>
                            </div>
                            <div className="cm-agent-task">
                              <div className="cm-agent-task-title">
                                <Terminal size={15} />
                                <strong>{currentThread.task}</strong>
                              </div>
                              <div className="cm-agent-task-meta">
                                <span>Owner: {currentThread.owner}</span>
                                <span>Original task stays in progress</span>
                              </div>
                              <div className="cm-agent-tool-steps">
                                <div>
                                  <Check size={12} />
                                  <span>
                                    {threadStatus === "escalated"
                                      ? "Ask queued / agent context not yet received"
                                      : "Ask received in agent context"}
                                  </span>
                                  <time>14:44:12</time>
                                </div>
                                {threadStatus !== "escalated" && (
                                  <>
                                    <div>
                                      <Check size={12} />
                                      <span>
                                        Read {currentThread.resource} through
                                        Radar
                                      </span>
                                      <time>14:45:03</time>
                                    </div>
                                    <div>
                                      <Link2 size={12} />
                                      <button
                                        onClick={() =>
                                          setInspector({
                                            id: `evidence-${currentThread.seq}`,
                                            actor:
                                              currentThread.owner + "'s agent",
                                            kind: "Agent finding",
                                            text: currentThread.finding,
                                            time: "14:46",
                                            evidence: currentThread.evidence,
                                            tone: "info",
                                          })
                                        }
                                      >
                                        {currentThread.evidence}
                                        <ArrowUpRight size={11} />
                                      </button>
                                      <time>14:46:08</time>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            </details>
                            <details className="cm-disclosure" key={`history-${selectedThread}`}>
                              <summary>History</summary>
                            <div className="cm-agent-ack-row">
                              <span>
                                <CheckCheck size={13} />
                                {threadStatus === "escalated"
                                  ? "Agent context not yet received"
                                  : "Agent context received"}
                              </span>
                              <span>
                                {ack ? (
                                  <>
                                    <Check size={13} />
                                    Human acknowledged by Jubril
                                  </>
                                ) : (
                                  <button
                                    disabled={isStale}
                                    onClick={acknowledgeThread}
                                  >
                                    Acknowledge ask
                                  </button>
                                )}
                              </span>
                              <small>
                                Acknowledgement does not answer the ask.
                              </small>
                            </div>
                            {sent
                              .filter(
                                (message) =>
                                  message.thread === selectedThread &&
                                  message.kind !== "reply",
                              )
                              .map((message, index) => (
                                <div
                                  key={index}
                                  className="cm-agent-outgoing-ask"
                                >
                                  <div>
                                    <Bot size={15} />
                                    <strong>
                                      Ask queued through Jubril's agent
                                    </strong>
                                    <Badge tone="info">Sample queue</Badge>
                                  </div>
                                  <p>{message.text}</p>
                                  <span>
                                    To {message.scope} via CaptainMorgue / no
                                    real delivery
                                  </span>
                                </div>
                              ))}
                            </details>
                            <details className="cm-disclosure" key={`details-${selectedThread}`}>
                              <summary>Details</summary>
                          <div className="cm-agent-route">
                            <div>
                              <Avatar small name={currentThread.sender} />
                              <span>
                                {currentThread.sender}
                                <small>Asked</small>
                              </span>
                            </div>
                            <ArrowRight size={13} />
                            <div>
                              <Ship size={17} />
                              <span>
                                CaptainMorgue<small>Routes every message</small>
                              </span>
                            </div>
                            <ArrowRight size={13} />
                            <div>
                              <Bot size={18} />
                              <span>
                                {currentThread.owner}'s agent
                                <small>Works for {currentThread.owner}</small>
                              </span>
                            </div>
                          </div>
                            </details>
                          </div>
                          {!wall && (
                            <div className="cm-agent-secondary-compose">
                              <button
                                className="cm-agent-compose-toggle"
                                aria-expanded={composerOpen}
                                onClick={() => setComposerOpen(!composerOpen)}
                              >
                                <Bot size={17} />
                                <span>
                                  Ask through my agent
                                  <small>
                                    Start a follow-up with an explicit recipient
                                  </small>
                                </span>
                                <ChevronDown size={15} />
                              </button>
                              {composerOpen && (
                                <div className="cm-composer">
                                  <label className="cm-compose-scope">
                                    Recipient
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
                                    placeholder="Ask your agent to coordinate a specific next step..."
                                    rows={3}
                                  />
                                  <div className="cm-composer-footer">
                                    <span>
                                      <GitBranch size={13} />
                                      Jubril's agent / CaptainMorgue / {scope}
                                    </span>
                                    <Button
                                      tone="amber"
                                      onClick={send}
                                      disabled={!draft.trim() || isStale}
                                    >
                                      <Send size={14} />
                                      Send ask through agent
                                    </Button>
                                  </div>
                                </div>
                              )}
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
                            <span>{plural(openParts.length, "Open part", "Open parts")}</span>
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
                              <div className="cm-agent-crew-task">
                                <div>
                                  <Bot size={17} />
                                  <strong>{person.name}'s agent</strong>
                                </div>
                                <p>
                                  {person.name === "Jubril"
                                    ? "Prepared a payment recovery answer for Emmanuel"
                                    : person.name === "Sammy"
                                      ? "Reading database connections through Radar"
                                      : "Confirmed check-in rollout state and briefed the crew"}
                                </p>
                                <Badge
                                  tone={
                                    person.name === "Jubril"
                                      ? coordinationTones[
                                          threadStatuses["Payment verification"]
                                        ]
                                      : person.name === "Sammy"
                                        ? "info"
                                        : "success"
                                  }
                                  dot
                                >
                                  {person.name === "Jubril"
                                    ? coordinationLabels[
                                        threadStatuses["Payment verification"]
                                      ]
                                    : person.name === "Sammy"
                                      ? "Agent working"
                                      : "Reply approved"}
                                </Badge>
                              </div>
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
                                    openComposer(
                                      person.name === "Emmanuel"
                                        ? "Payment verification"
                                        : person.name === "Sammy"
                                          ? "Database coordination"
                                          : "Platform handoff",
                                      person.name === "Jubril"
                                        ? "All responders"
                                        : person.name,
                                    );
                                  }}
                                >
                                  <Bot size={14} />
                                  Ask agent
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
                    {view === "postmortems" && <Postmortems documents={SAMPLE_POSTMORTEMS} />}
                    {view === "record" && (
                      <div className="cm-record-layout">
                        <article className="cm-record-paper">
                          <div className="cm-record-top">
                            <div>
                              <span className="cm-eyebrow">
                                Incident record / INC-2041
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
                                {resolved ? "CLOSED" : "In progress"}
                              </strong>
                              <span>
                                {resolved
                                  ? "14:51 / Sample"
                                  : "Live draft / Sample"}
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
                          <ResponseTimeline resolved={resolved} />
                          <section className="cm-record-section">
                            <span className="cm-section-number">03</span>
                            <div>
                              <h3>Prevention</h3>
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
                              Past incident / INC-1877
                            </span>
                            <h3>Same query. Last year's conference.</h3>
                            <p>
                              Slow check-in after a release. An index restored
                              service, but no query-plan check followed.
                            </p>
                            <div className="cm-record-aside-rule" />
                            <span className="cm-eyebrow">The lesson</span>
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
            <SidePanel title="Evidence inspector" onClose={() => setInspector(null)}>
              <div className="cm-inspector-content">
              <Badge tone={inspector.tone}>{inspector.kind}</Badge>
              <h2>{inspector.evidence || inspector.kind}</h2>
              <div className="cm-inspector-byline">
                <Avatar small name={inspector.actor} />
                <span>{inspector.actor}</span>
                <time>{inspector.time}</time>
              </div>
              {!events.some((event) => event.id === inspector.id) && (
                <p className="cm-inspector-summary">{inspector.text}</p>
              )}
              {inspector.actor === "Radar" && (
                <div className="cm-inspector-block">
                  <span className="cm-eyebrow">Sample evidence</span>
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
              <Button
                onClick={() => {
                  openComposer(
                    "Platform handoff",
                    "All responders",
                    `Regarding ${inspector.evidence || inspector.kind}: `,
                  );
                }}
              >
                <MessageSquare size={15} />
                Discuss with the crew
              </Button>
              <p className="cm-inspector-disclaimer">
                Sample evidence for design review. No external investigation is
                opened.
              </p>
              </div>
            </SidePanel>
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
                    <span>Emmanuel / Registration</span>
                    <strong>Abort check-in canary</strong>
                    <p>Existing requests are draining.</p>
                  </div>
                  <div>
                    <span>Sammy / Platform</span>
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
                      ? `${openParts.length} ${plural(openParts.length, "part", "parts")} still open. Resolve them before closing.`
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
  const neutrals = [
    "bg-page",
    "bg-card",
    "bg-layer",
    "bg-subtle",
    "text-strong",
    "text-subtle",
    "text-sub",
    "text-soft",
    "stroke-soft",
    "stroke-mild",
    "stroke-strong",
  ];
  const statuses = [
    { token: "critical", label: "Critical", shape: "is-critical" },
    { token: "warning", label: "Investigating", shape: "is-warning" },
    { token: "resolved", label: "Resolved", shape: "is-resolved" },
    { token: "accent", label: "Information", shape: "is-info" },
    { token: "text-soft", label: "Offline", shape: "is-offline" },
    { token: "conflict", label: "Conflict", shape: "is-conflict" },
  ];
  function values(token: string) {
    const matches = [
      ...tokenSource.matchAll(new RegExp(`--cm-${token}:\\s*([^;]+);`, "g")),
    ];
    function hex(value: string) {
      const rgba = value.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
      if (!rgba) return value;
      const channels = [
        Number(rgba[1]),
        Number(rgba[2]),
        Number(rgba[3]),
        Math.round(Number(rgba[4]) * 255),
      ];
      return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
    }
    return (
      <code>
        Light {hex(matches[0][1])}
        <br />
        Dark {hex(matches.at(-1)![1])}
      </code>
    );
  }
  return (
    <div className="cm-foundations">
      <header>
        <span className="cm-eyebrow">CAPTAINMORGUE / DESIGN FOUNDATIONS</span>
        <div className="cm-foundations-brand">
          A little spirit.
          <br />A clear head.
        </div>
        <p>
          Neutral surfaces, clear type, and one accent. Status has a shape and
          a name; the toe tag marks resolved work.
        </p>
        <Badge tone="neutral">Hackathon library / 01</Badge>
      </header>
      <section>
        <div className="cm-foundation-heading">
          <span>01</span>
          <h2>Neutrals, one accent, and clear status</h2>
        </div>
        <div className="cm-swatches">
          {[...neutrals, "accent"].map((token) => (
            <div key={token}>
              <div style={{ background: `var(--cm-${token})` }} />
              <strong>--cm-{token}</strong>
              {values(token)}
            </div>
          ))}
        </div>
        <div className="cm-foundation-statuses">
          {statuses.map(({ token, label, shape }) => (
            <div key={label}>
              <span className="cm-badge">
                <span className={`cm-status-dot ${shape}`} aria-hidden="true" />
                {label}
              </span>
              <strong>--cm-{token}</strong>
              {values(token)}
            </div>
          ))}
          <div>
            <span className="cm-toe-tag">Resolved</span>
            <strong>--cm-tag</strong>
            {values("tag")}
            <strong>--cm-tag-ink</strong>
            {values("tag-ink")}
          </div>
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
              <span className="cm-badge">
                <span className="cm-status-dot is-conflict" aria-hidden="true" />
                Conflict
              </span>
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
            <span>DISPLAY / FUNNEL DISPLAY</span>
            <strong className="cm-serif-sample">CaptainMorgue</strong>
          </div>
          <div>
            <span>INTERFACE / GEIST</span>
            <strong>Every action has a person behind it.</strong>
          </div>
          <div>
            <span>EVIDENCE / GEIST MONO</span>
            <code>14:44:20 / deployment/checkin / INC-2041</code>
          </div>
        </div>
      </section>
      <footer>Quiet surfaces. Urgency only where it belongs.</footer>
    </div>
  );
}
