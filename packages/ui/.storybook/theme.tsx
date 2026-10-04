// The toolbar's theme and mode, applied the way the web app does it: the mode as `data-theme` on
// <html>, so portals follow too. A theme other than the default, whose values tokens.css doesn't
// hold, gets its variables in a style element after tokens.css.
import { useLayoutEffect } from 'react';

import {
  defaultTheme,
  renderModeVariables,
  shapeRoles,
  themes,
  type Mode,
  type ThemeName,
} from '../src/tokens/index.ts';

const styleId = 'chaku-theme';

function themeCss(name: ThemeName): string {
  const theme = themes[name];
  const shape = shapeRoles.map((role) => `  --${role}: ${theme.shape[role]};`).join('\n');
  return `${renderModeVariables(theme)}\n\n:root {\n${shape}\n}\n`;
}

export function ThemeFrame({
  theme,
  mode,
  children,
}: {
  theme: ThemeName;
  mode: Mode;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset['theme'] = mode;
    document.getElementById(styleId)?.remove();
    if (themes[theme] !== defaultTheme) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = themeCss(theme);
      document.head.append(style);
    }
  }, [theme, mode]);
  return children;
}
