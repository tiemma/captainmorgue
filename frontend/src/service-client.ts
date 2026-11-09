export type Role = 'commander' | 'responder' | 'scribe';

export interface Resource {
  kind: string;
  namespace?: string;
  name: string;
}

export interface IncidentEvent {
  id: string;
  seq: number;
  incident_id: string;
  ts: string;
  actor: string;
  team?: string;
  type: string;
  text: string;
  resource?: Resource;
  artifacts?: { label: string; url?: string }[];
  to?: string[];
  why?: string;
  term?: number;
  reply_to?: number;
}

export type Event = IncidentEvent;

export interface Person {
  status: string;
  team: string;
  last_seen: string | null;
  role?: Role;
  task?: string;
  repo?: string;
  tools?: string[];
}

export interface TeamState {
  id: string;
  name: string;
  manager: string;
  members: string[] | null;
  owns: string[] | null;
  term: number;
  pulled_in: boolean;
}

export interface Claim {
  key: string;
  actor: string;
  text: string;
  since: string;
  expires: string;
}

export interface PastMatch {
  id: string;
  summary: string;
  fixed_by: string;
}

export interface Signal {
  label?: string;
  service?: string;
  value: string;
  status: string;
  spark?: number[];
}

export interface Envelope {
  id: string;
  seq: number;
  ts: string;
  from: string;
  to: string[] | null;
  kind: string;
  text: string;
  why?: string;
  term?: number;
  priority: 'interrupt' | 'inject';
  reply_to?: number;
}

export interface IncidentState {
  commander?: string;
  incident: {
    id: string;
    title: string;
    status: string;
    severity?: string;
    opened: string | null;
    closed: string | null;
  };
  teams: TeamState[] | null;
  people: { [actor: string]: Person };
  parts: { id: string; name: string; owner: string; progress: number; status: string; resolved_at: string | null; note: string }[] | null;
  relay: { from: string; to: string[] | null; text: string; why: string } | null;
  conflict: IncidentEvent | null;
  signals: { [name: string]: Signal };
  past_match: PastMatch | null;
  claims: Claim[] | null;
  deliveries: { [seq: string]: { [actor: string]: string } } | null;
  prs?: PullRequest[] | null;
}

export interface PullRequest {
  service: string;
  url: string;
  author: string;
  ts: string;
}

export interface Moment {
  ts: string;
  actor: string;
  type: string;
  text: string;
}

export interface Step {
  ts: string;
  actor: string;
  text: string;
  status: string;
  resource?: string;
  exit_code?: number;
  duration_ms?: number;
  failed: boolean;
  change: boolean;
}

export interface ImpactWindow {
  opened: string | null;
  detected: string | null;
  mitigated: string | null;
  resolved: string | null;
  closed: string | null;
  to_mitigate: string;
  to_resolve: string;
  duration: string;
}

export interface ActionItem {
  text: string;
  owner: string;
  link: string;
  due?: string;
}

export interface RecordSummary {
  id: string;
  title: string;
  severity: string;
  opened: string | null;
  resolved: string | null;
  duration: string;
  summary: string;
  fixed_by: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  opened: string | null;
  resolved: string | null;
  duration: string;
  people: number;
  teams: number;
  conflicts: number;
  parts: { name: string; how: string }[] | null;
  improvements: ActionItem[] | null;
  past_match: PastMatch | null;
  events: IncidentEvent[] | null;
  status?: string;
  severity?: string;
  written_by?: string;
  window?: ImpactWindow;
  summary?: string;
  fixed_by?: string;
  root_cause?: string;
  contributing_factors?: string[] | null;
  timeline?: Moment[] | null;
  went_well?: string[] | null;
  went_badly?: string[] | null;
  errors?: Moment[] | null;
  remediation?: PullRequest[] | null;
  action_items?: ActionItem[] | null;
  steps?: { actor: string; steps: Step[] }[] | null;
  changes?: Step[] | null;
}

export type Record = IncidentRecord;

export interface MessageRequest {
  from: string;
  to: string[];
  kind: 'ask' | 'broadcast' | 'reply';
  text: string;
  reply_to?: number;
}

export interface JoinRequest {
  actor: string;
  team: string;
  role: Role;
  task?: string;
  repo?: string;
  tools?: string[];
}

export interface JoinResponse {
  incident: string;
  team: string;
  manager: string;
  term: number;
  role: Role;
  commander: string;
  members: { actor: string; status: string }[] | null;
  cursor: number;
}

let sessionToken = '';

export function setSessionToken(token: string) {
  sessionToken = token.trim();
}

export class ServiceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ServiceError';
  }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new ServiceError(message || `Request failed (${response.status})`, response.status);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function fetchRecord(id: string, signal?: AbortSignal) {
  return request<IncidentRecord>(`/record/${encodeURIComponent(id)}`, undefined, signal);
}

export function fetchRecords(signal?: AbortSignal) {
  return request<RecordSummary[] | null>('/records', undefined, signal);
}

export function setIncidentStatus(
  incidentId: string,
  change: { actor: string; status?: string; severity?: string; why?: string },
  signal?: AbortSignal,
) {
  return request<{ status: string; severity: string }>(
    `/incidents/${encodeURIComponent(incidentId)}/status`,
    change,
    signal,
  );
}

export function sendMessage(message: MessageRequest, signal?: AbortSignal) {
  return request<{ seq: number; to: string[] | null; why: string }>('/messages', message, signal);
}

export function join(incidentId: string, profile: JoinRequest, signal?: AbortSignal) {
  return request<JoinResponse>(`/incidents/${encodeURIComponent(incidentId)}/join`, profile, signal);
}

export function heartbeat(actor: string, signal?: AbortSignal) {
  return request<void>('/heartbeat', { actor }, signal);
}

export function fetchInbox(actor: string, after: number | undefined, signal?: AbortSignal) {
  const query = after === undefined ? 'wait=25' : `after=${after}&wait=25`;
  return request<{ messages: Envelope[] | null; cursor: number }>(`/inbox/${encodeURIComponent(actor)}?${query}`, undefined, signal);
}

export function ackInbox(actor: string, seq: number) {
  return request<void>(`/inbox/${encodeURIComponent(actor)}/ack`, { seq });
}

export function broadcast(from: string, text: string) {
  return request<void>('/broadcast', { from, text });
}

export function updateTask(incidentId: string, actor: string, task: string) {
  return request<void>(`/incidents/${encodeURIComponent(incidentId)}/task`, { actor, task });
}

export function leave(incidentId: string, actor: string) {
  return request<void>(`/incidents/${encodeURIComponent(incidentId)}/leave`, { actor });
}
