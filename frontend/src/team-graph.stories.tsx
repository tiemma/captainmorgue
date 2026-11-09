import type { Meta, StoryObj } from '@storybook/react-vite';
import { TeamGraphView } from './team-graph';
import type { TeamGraph } from './service-client';

const sample: TeamGraph = {
  window: { start: null, end: null },
  nodes: [
    { id: 'org:captainmorgue', kind: 'org', name: 'CaptainMorgue', child_count: 3 },
    { id: 'team:registration', kind: 'team', name: 'Registration', parent_id: 'org:captainmorgue', child_count: 4, manager: 'emmanuel', status: 'pulled_in' },
    { id: 'team:platform', kind: 'team', name: 'Platform', parent_id: 'org:captainmorgue', child_count: 4, manager: 'sammy', status: 'pulled_in' },
    { id: 'team:ticketing', kind: 'team', name: 'Ticketing', parent_id: 'org:captainmorgue', child_count: 2, manager: 'jubril', status: 'standby' },
    { id: 'person:emmanuel', kind: 'person', name: 'emmanuel', parent_id: 'team:registration', child_count: 0, status: 'online' },
    { id: 'person:sammy', kind: 'person', name: 'sammy', parent_id: 'team:platform', child_count: 0, status: 'online' },
    { id: 'person:jubril', kind: 'person', name: 'jubril', parent_id: 'team:ticketing', child_count: 0, status: 'suspect' },
    { id: 'service:checkin', kind: 'service', name: 'checkin', parent_id: 'team:registration', child_count: 0 },
    { id: 'service:kiosk', kind: 'service', name: 'kiosk', parent_id: 'team:registration', child_count: 0 },
    { id: 'service:confdb', kind: 'service', name: 'confdb', parent_id: 'team:platform', child_count: 0 },
    { id: 'service:otel-collector', kind: 'service', name: 'otel-collector', parent_id: 'team:platform', child_count: 0 },
    { id: 'service:payments', kind: 'service', name: 'payments', parent_id: 'team:ticketing', child_count: 0 },
  ],
  links: [
    { a: 'team:registration', b: 'team:platform', means: 'depends_on', source: 'inferred', count: 2, evidence: ['event 6', 'event 9'] },
    { a: 'team:platform', b: 'team:registration', means: 'messaged', source: 'observed', count: 4, evidence: ['event 4', 'event 5', 'event 7'] },
    { a: 'team:platform', b: 'team:registration', means: 'shared_incident', source: 'observed', count: 1, evidence: ['INC-2041'] },
    { a: 'team:registration', b: 'team:ticketing', means: 'messaged', source: 'observed', count: 1, evidence: ['event 11'] },
  ],
};

const meta = {
  title: 'Screens/Team graph',
  component: TeamGraphView,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="cm-foundations" style={{ padding: 24 }}><Story /></div>],
  args: { graph: sample },
} satisfies Meta<typeof TeamGraphView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Relationships: Story = {};
export const Loading: Story = { args: { graph: undefined, loading: true } };
export const Unavailable: Story = { args: { graph: undefined, error: 'The team graph could not be loaded.', onRetry: () => undefined } };
