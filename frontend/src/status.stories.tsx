import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Panel, ProgressStatus } from './ui';

const meta = {
  title: 'Design system/Progress states',
  component: ProgressStatus,
  parameters: { layout: 'centered' },
  args: { state: 'working', children: 'Agent is investigating' },
  argTypes: { state: { control: 'select', options: ['working', 'waiting', 'done'] } },
  decorators: [(Story) => <div className="cm-foundations" style={{ padding: 24 }}><Story /></div>],
} satisfies Meta<typeof ProgressStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Working: Story = {};
export const Waiting: Story = { args: { state: 'waiting', children: 'Waiting for your approval' } };
export const Done: Story = { args: { state: 'done', children: 'Approved reply sent' } };

function StateTransitions() {
  const [state, setState] = useState<'working' | 'waiting' | 'done'>('working');
  const label = { working: 'Agent is investigating', waiting: 'Waiting for your approval', done: 'Approved reply sent' };
  return <Panel title="Sample agent workflow">
    <div style={{ display: 'grid', gap: 20, padding: '12px 0' }}>
      <ProgressStatus state={state}>{label[state]}</ProgressStatus>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => setState('working')}>Start working</Button>
        <Button onClick={() => setState('waiting')}>Wait for approval</Button>
        <Button onClick={() => setState('done')}>Mark done</Button>
      </div>
    </div>
  </Panel>;
}

export const Transitions: Story = { render: () => <StateTransitions /> };
