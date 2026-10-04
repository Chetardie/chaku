import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { colorRoles, modes, themes, type ThemeName } from '../tokens/index.ts';
import { TokensPage } from './tokens-page.tsx';

const meta = {
  title: 'Foundations/Tokens',
  component: TokensPage,
  parameters: { layout: 'fullscreen' },
  args: { theme: themes.warm },
  // The theme follows the toolbar.
  render: (args, { globals }) => (
    <TokensPage {...args} theme={themes[globals['theme'] as ThemeName]} />
  ),
} satisfies Meta<typeof TokensPage>;

export default meta;

export const Tokens: StoryObj<typeof meta> = {
  play: async ({ canvasElement, globals }) => {
    // The toolbar's mode reaches <html>, as the theme cookie does in the web app.
    await expect(document.documentElement.dataset['theme']).toBe(globals['mode']);
    // Every colour role shows once per mode.
    for (const mode of modes) {
      const column = within(canvasElement).getByRole('region', {
        name: mode === 'light' ? 'Light' : 'Dark',
      });
      const list = within(column).getByRole('list', { name: 'Colour roles' });
      for (const role of colorRoles) {
        await expect(within(list).getByText(role, { exact: true })).toBeVisible();
      }
    }
  },
};
