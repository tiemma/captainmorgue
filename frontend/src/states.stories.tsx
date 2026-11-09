import type { Meta, StoryObj } from '@storybook/react-vite';
import { CaptainWorkspace } from './screens';

const meta = {
  title: 'States/Incident',
  component: CaptainWorkspace,
  args: { initialView: 'incident', scenario: 'active' },
  render: (args) => <CaptainWorkspace key={`${args.initialView}-${args.scenario}`} {...args} />,
} satisfies Meta<typeof CaptainWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConflictNeedsAttention: Story = { args: { scenario: 'conflict' } };
export const Reconnecting: Story = { args: { scenario: 'reconnecting' } };
export const Resolved: Story = { args: { scenario: 'resolved' } };
export const NoActiveIncident: Story = { args: { scenario: 'empty' } };
