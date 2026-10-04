// The Tokens page in Storybook: every semantic role of a theme as a swatch in light and dark, side
// by side, plus the Participant names, status colours, shapes and scales (ADR-0015). Each half sets
// `data-theme`, so it shows that mode whatever the toolbar says.
import {
  colorRoles,
  contrastPairs,
  contrastRatio,
  fontWeight,
  modes,
  shapeRoles,
  spacing,
  typeScale,
  zIndex,
  type ColorRole,
  type Mode,
  type Theme,
} from '../tokens/index.ts';

const participants = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const statuses = ['success', 'warning', 'danger', 'info'] as const;
const modeNames: Record<Mode, string> = { light: 'Light', dark: 'Dark' };

/** The lowest contrast a role has in the listed pairs, where it is the foreground. */
function lowestContrast(theme: Theme, mode: Mode, role: ColorRole): number | undefined {
  const ratios = contrastPairs
    .filter((pair) => pair.foreground === role)
    .map((pair) => contrastRatio(theme.modes[mode][role], theme.modes[mode][pair.background]));
  return ratios.length > 0 ? Math.min(...ratios) : undefined;
}

function Swatch({ role }: { role: string }) {
  return (
    <span
      aria-hidden
      className="size-10 shrink-0 rounded-lg border border-border"
      style={{ backgroundColor: `var(--${role})` }}
    />
  );
}

function ColorRoles({ theme, mode }: { theme: Theme; mode: Mode }) {
  return (
    <ul aria-labelledby={`tokens-${mode}-roles`} className="grid gap-2">
      {colorRoles.map((role) => {
        const ratio = lowestContrast(theme, mode, role);
        return (
          <li key={role} className="flex items-center gap-3">
            <Swatch role={role} />
            <span className="grid">
              <span className="font-mono text-sm">{role}</span>
              <span className="text-xs text-muted-foreground">
                {theme.modes[mode][role]}
                {ratio === undefined ? null : ` · lowest contrast ${ratio.toFixed(1)}:1`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ParticipantNames() {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-card bg-chat-background p-4">
      {participants.map((n) => (
        <p
          key={n}
          className="rounded-bubble rounded-bl-bubble-tail bg-bubble-other px-3 py-2 text-bubble-other-foreground"
        >
          <span
            className="block text-sm font-semibold"
            style={{ color: `var(--participant-${String(n)})` }}
          >
            Participant {n}
          </span>
          Hi!
        </p>
      ))}
    </div>
  );
}

function Statuses() {
  return (
    <div className="grid gap-2">
      {statuses.map((status) => (
        <p key={status} className="flex items-center gap-3">
          <span
            className="rounded-pill px-3 py-1 text-sm font-semibold"
            style={{
              backgroundColor: `var(--${status})`,
              color: `var(--${status}-foreground)`,
            }}
          >
            {status}
          </span>
          <span style={{ color: `var(--${status})` }}>{status} as text</span>
        </p>
      ))}
    </div>
  );
}

function ModeColumn({ theme, mode }: { theme: Theme; mode: Mode }) {
  const heading = `tokens-${mode}`;
  return (
    <section
      data-theme={mode}
      aria-labelledby={heading}
      className="grid content-start gap-6 rounded-card bg-background p-6 text-foreground"
    >
      <h2 id={heading} className="text-2xl font-extrabold">
        {modeNames[mode]}
      </h2>
      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">Chat</h3>
        <div className="grid gap-2 rounded-card bg-chat-background p-4">
          <p className="max-w-3/4 justify-self-start rounded-bubble rounded-bl-bubble-tail bg-bubble-other px-3 py-2 text-bubble-other-foreground">
            Who&apos;s up for a game?
          </p>
          <p className="max-w-3/4 justify-self-end rounded-bubble rounded-br-bubble-tail bg-bubble-own px-3 py-2 text-bubble-own-foreground">
            Me! Send a Game Challenge
          </p>
          <p className="justify-self-start rounded-card bg-challenge px-4 py-3 font-semibold text-challenge-foreground">
            Four in a Row: your move
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-pill bg-presence-online" />
            online
            <span className="ml-auto rounded-pill bg-unread px-2 text-xs font-semibold text-unread-foreground">
              3
            </span>
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">Participant names</h3>
        <ParticipantNames />
      </div>
      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">Status</h3>
        <Statuses />
      </div>
      <div className="grid gap-3">
        <h3 id={`tokens-${mode}-roles`} className="text-lg font-semibold">
          Colour roles
        </h3>
        <ColorRoles theme={theme} mode={mode} />
      </div>
    </section>
  );
}

function Scales({ theme }: { theme: Theme }) {
  return (
    <section
      aria-labelledby="tokens-scales"
      className="grid gap-6 rounded-card bg-card p-6 text-card-foreground"
    >
      <h2 id="tokens-scales" className="text-2xl font-extrabold">
        Shape and scales
      </h2>
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold">Shape roles</h3>
        <ul className="grid gap-1 text-sm">
          {shapeRoles.map((role) => (
            <li key={role}>
              <span className="font-mono">{role}</span>
              <span className="text-muted-foreground">: {theme.shape[role]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold">Type scale</h3>
        {Object.entries(typeScale).map(([step, { size, lineHeight }]) => (
          <p key={step} style={{ fontSize: `var(--text-${step})`, lineHeight }}>
            text-{step} · {size} / {lineHeight}
          </p>
        ))}
        <p>
          {Object.entries(fontWeight).map(([name, weight]) => (
            <span key={name} className="mr-4" style={{ fontWeight: weight }}>
              font-{name} {weight}
            </span>
          ))}
        </p>
        <p className="font-mono text-sm">font-mono: const chat = await getChat(id);</p>
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold">Spacing ({spacing} steps)</h3>
        {[1, 2, 3, 4, 6, 8, 12, 16].map((step) => (
          <p key={step} className="flex items-center gap-3 text-sm">
            <span className="w-10 font-mono">{step}</span>
            <span
              aria-hidden
              className="h-3 rounded-xs bg-primary"
              style={{ width: `calc(var(--spacing) * ${String(step)})` }}
            />
          </p>
        ))}
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold">Layers</h3>
        <ul className="grid gap-1 text-sm">
          {Object.entries(zIndex).map(([name, value]) => (
            <li key={name}>
              <span className="font-mono">z-{name}</span>
              <span className="text-muted-foreground">: {value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TokensPage({ theme }: { theme: Theme }) {
  return (
    <main className="grid gap-6 p-6">
      <header className="grid gap-2">
        <h1 className="text-3xl font-extrabold">Tokens: {theme.name}</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every semantic role in light and dark. Components use them as Tailwind utilities
          (bg-bubble-own, text-muted-foreground), never as values. Change them in
          packages/ui/src/tokens/themes.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        {modes.map((mode) => (
          <ModeColumn key={mode} theme={theme} mode={mode} />
        ))}
      </div>
      <Scales theme={theme} />
    </main>
  );
}
