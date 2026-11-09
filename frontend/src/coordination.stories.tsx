import type { Meta, StoryObj } from '@storybook/react-vite';
import { CaptainWorkspace } from './screens';

const meta = {
  title: 'States/Agent coordination',
  component: CaptainWorkspace,
  args: { initialView: 'messages', scenario: 'active' },
  render: (args) => <CaptainWorkspace key={`${args.initialConversation}-${args.scenario}`} {...args} />,
} satisfies Meta<typeof CaptainWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsApproval: Story = { args: { initialConversation: 'Payment verification' } };
export const NeedsHumanInput: Story = { args: { initialConversation: 'Database coordination' } };
export const AgentWorking: Story = { args: { initialConversation: 'Connection recovery' } };
export const Answered: Story = { args: { initialConversation: 'Canary rollback' } };
export const UnbriefedEscalation: Story = { args: { initialConversation: 'Platform handoff' } };
export const DisconnectedApproval: Story = { args: { initialConversation: 'Payment verification', scenario: 'reconnecting' } };
