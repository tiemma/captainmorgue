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

export interface IncidentState {
  commander?: string;
  incident: {
    id: string;
    title: string;
    status: string;
    opened: string | null;
    closed: string | null;
  };
  teams: TeamState[] | null;
  people: { [actor: string]: Person };
  parts: { id: string; name: string; owner: string; progress: number; status: string; resolved_at: string | null; note: string }[] | null;
  relay: { from: string; to: string[] | null; text: string; why: string } | null;
  conflict: IncidentEvent | null;
  signals: { [name: string]: { value: string; status: string } };
  past_match: PastMatch | null;
  claims: Claim[] | null;
  deliveries: { [seq: string]: { [actor: string]: string } } | null;
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
  improvements: { text: string; owner: string; link: string }[] | null;
  past_match: PastMatch | null;
  events: IncidentEvent[] | null;
  steps: RecordStep[] | null;
  commands: CommandRun[] | null;
}

export type Record = IncidentRecord;

export interface CommandRun {
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
  resource?: Resource;
  changed: boolean;
  led_to_resolution: boolean;
}

export interface RecordStep {
  seq: number;
  ts: string;
  actor: string;
  team?: string;
  kind: string;
  text: string;
  command?: string;
  outcome?: string;
  resource?: Resource;
}

export interface Postmortem {
  id: string;
  title: string;
  status: string;
  summary: string;
  opened?: string;
  resolved?: string;
  fixed_by?: string;
  parts: { name: string; resolution: string }[];
  improvements: { text: string; owner?: string; link?: string }[] | null;
  events: { time: string; title: string; detail?: string }[];
  steps: RecordStep[];
  commands: CommandRun[];
}

export function fetchPostmortems(signal?: AbortSignal) {
  return request<Postmortem[]>('/postmortems', undefined, signal);
}

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
  if (body !== undefined && sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchRecord(id: string, signal?: AbortSignal) {
  return request<IncidentRecord>(`/record/${encodeURIComponent(id)}`, undefined, signal);
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

export type GraphMeans = 'part_of' | 'member_of' | 'manages' | 'owns' | 'depends_on' | 'messaged' | 'shared_incident';

export interface GraphNode {
  id: string;
  kind: 'org' | 'team' | 'person' | 'service';
  name: string;
  parent_id?: string;
  child_count: number;
  manager?: string;
  status?: string;
}

export interface GraphLink {
  a: string;
  b: string;
  means: GraphMeans;
  source: 'configured' | 'observed' | 'inferred';
  count: number;
  evidence: string[];
}

export interface TeamGraph {
  window: { start: string | null; end: string | null };
  nodes: GraphNode[];
  links: GraphLink[];
}

export function fetchGraph(signal?: AbortSignal) {
  return request<TeamGraph>('/api/graph', undefined, signal);
}
