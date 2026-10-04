import type { Preview } from '@storybook/react-vite';

import { modes, themes, type Mode, type ThemeName } from '../src/tokens/index.ts';
import './preview.css';
import { ThemeFrame } from './theme.tsx';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: Object.keys(themes),
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Light or dark mode',
      toolbar: { title: 'Mode', icon: 'mirror', items: [...modes], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'warm', mode: 'light' },
  parameters: {
    // Accessibility violations fail the story's test in CI, not just show in the panel.
    a11y: { test: 'error' },
  },
  decorators: [
    (Story, { globals }) => (
      <ThemeFrame theme={globals['theme'] as ThemeName} mode={globals['mode'] as Mode}>
        <Story />
      </ThemeFrame>
    ),
  ],
};

export default preview;
