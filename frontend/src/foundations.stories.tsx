import type { Meta, StoryObj } from '@storybook/react-vite';
import { Foundations } from './screens';

const meta = {
  title: 'Design system/Foundations',
  component: Foundations,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Foundations>;

export default meta;
type Story = StoryObj<typeof meta>;
export const PaletteAndComponents: Story = {};
