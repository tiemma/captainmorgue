import type { Preview } from '@storybook/react-vite';
import '../src/tokens.css';
import '../src/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Screens', 'States', 'Design system'] } },
    controls: { expanded: true },
    a11y: { test: 'todo' },
  },
};

export default preview;
