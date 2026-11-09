import type { Meta, StoryObj } from '@storybook/react-vite';
import { CaptainWorkspace } from './screens';

const meta = {
  title: 'Screens/Workspace',
  component: CaptainWorkspace,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    initialView: { control: 'select', options: ['incident', 'messages', 'crew', 'record', 'join', 'postmortems'] },
    scenario: { control: 'select', options: ['active', 'conflict', 'reconnecting', 'resolved', 'empty'] },
    wallMode: { control: 'boolean' },
    initialConversation: { control: 'select', options: ['Payment verification', 'Database coordination', 'Connection recovery', 'Canary rollback', 'Platform handoff'] },
  },
  args: { initialView: 'incident', scenario: 'active', wallMode: false },
  render: (args) => <CaptainWorkspace key={`${args.initialView}-${args.scenario}-${args.wallMode}-${args.initialConversation}`} {...args} />,
} satisfies Meta<typeof CaptainWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Incident: Story = {};
export const Messages: Story = { name: 'Requests', args: { initialView: 'messages' } };
export const Crew: Story = { args: { initialView: 'crew' } };
export const ActiveRecord: Story = { name: 'Record / active', args: { initialView: 'record', scenario: 'active' } };
export const Record: Story = { args: { initialView: 'record', scenario: 'resolved' } };
export const Join: Story = { args: { initialView: 'join' } };
export const WallScreen: Story = { args: { wallMode: true, scenario: 'conflict' } };

export const PostmortemsLibrary: Story = { name: 'Postmortems', args: { initialView: 'postmortems' } };
