// Proves the dependency-cruiser rules (CHK-13; ADR-0002, ADR-0003, ADR-0007) on small fixture
// workspaces laid out like the repo, so each rule is seen to fail the forbidden import and pass
// the allowed ones.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cruise, type ICruiseResult } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

import config from '../dependency-cruiser.js';

/** Workspace packages the fixtures can import by name, as pnpm links them. */
const workspacePackages = {
  '@chaku/chat': 'packages/modules/chat',
  '@chaku/identity': 'packages/modules/identity',
  '@chaku/content': 'packages/content',
  '@chaku/game-sdk': 'packages/game-sdk',
  '@chaku/ui': 'packages/ui',
};

/** Cruises a fixture workspace of `files` with the repo's config and lists the violations. */
async function violations(files: Record<string, string>): Promise<string[]> {
  const root = mkdtempSync(path.join(os.tmpdir(), 'chaku-boundaries-'));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  try {
    for (const [name, dir] of Object.entries(workspacePackages)) {
      const pkg = { name, type: 'module', exports: { '.': './src/index.ts' } };
      write(`${dir}/package.json`, JSON.stringify(pkg));
      write(`${dir}/src/index.ts`, 'export const entry = 1;\n');
      mkdirSync(path.join(root, 'node_modules/@chaku'), { recursive: true });
      symlinkSync(path.join(root, dir), path.join(root, 'node_modules', name), 'junction');
    }
    mkdirSync(path.join(root, 'apps'), { recursive: true });
    for (const [file, content] of Object.entries(files)) write(file, content);

    const { output } = await cruise(['apps', 'packages'], {
      ...config.options,
      baseDir: root,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
    });
    return (output as ICruiseResult).summary.violations
      .map((violation) => `${violation.rule.name}: ${violation.from} → ${violation.to}`)
      .sort();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const leaf = 'export const value = 1;\n';

describe('module boundaries', () => {
  it('allows imports through public entry points and within a module', async () => {
    expect(
      await violations({
        'apps/web/src/page.ts': "import '@chaku/chat';\nimport '@chaku/ui';\n",
        'packages/modules/chat/src/send.ts':
          "import '@chaku/identity';\nimport '@chaku/content';\nimport './queue';\n",
        'packages/modules/chat/src/queue.ts': leaf,
        'apps/games/reference/src/game.ts':
          "import '@chaku/game-sdk';\nimport '@chaku/ui';\nimport './board';\n",
        'apps/games/reference/src/board.ts': leaf,
        'packages/ui/src/button.ts': "import '@chaku/content';\n",
      }),
    ).toEqual([]);
  });

  it('fails a deep import from one module into another', async () => {
    expect(
      await violations({
        'packages/modules/chat/src/send.ts': "import '../../identity/src/profiles';\n",
        'packages/modules/identity/src/profiles.ts': leaf,
      }),
    ).toEqual([
      'no-deep-import-between-modules: packages/modules/chat/src/send.ts → packages/modules/identity/src/profiles.ts',
    ]);
  });

  it('fails a deep import from an app into a module', async () => {
    expect(
      await violations({
        'apps/web/src/page.ts': "import '../../../packages/modules/chat/src/queue';\n",
        'packages/modules/chat/src/queue.ts': leaf,
      }),
    ).toEqual([
      'no-deep-import-into-modules: apps/web/src/page.ts → packages/modules/chat/src/queue.ts',
    ]);
  });

  it("fails a deep import past a module's package exports", async () => {
    expect(
      await violations({
        'apps/web/src/page.ts': "import '@chaku/chat/src/queue';\n",
        'packages/modules/chat/src/queue.ts': leaf,
      }),
    ).toEqual(['not-to-unresolvable: apps/web/src/page.ts → @chaku/chat/src/queue']);
  });

  it('fails a Game importing app code, a module or another Game', async () => {
    expect(
      await violations({
        'apps/games/reference/src/game.ts':
          "import '../../../web/src/session';\nimport '@chaku/chat';\nimport '../../other/src/rules';\n",
        'apps/web/src/session.ts': leaf,
        'apps/games/other/src/rules.ts': leaf,
      }),
    ).toEqual([
      'games-import-only-game-sdk-and-ui: apps/games/reference/src/game.ts → apps/games/other/src/rules.ts',
      'games-import-only-game-sdk-and-ui: apps/games/reference/src/game.ts → apps/web/src/session.ts',
      'games-import-only-game-sdk-and-ui: apps/games/reference/src/game.ts → packages/modules/chat/src/index.ts',
      'no-imports-between-apps: apps/games/reference/src/game.ts → apps/web/src/session.ts',
    ]);
  });

  it('fails content, game-sdk or ui importing a module', async () => {
    expect(
      await violations({
        'packages/content/src/mentions.ts': "import '@chaku/identity';\n",
        'packages/game-sdk/src/host.ts': "import '@chaku/chat';\n",
        'packages/ui/src/avatar.ts': "import '@chaku/identity';\n",
      }),
    ).toEqual([
      'shared-packages-import-no-module: packages/content/src/mentions.ts → packages/modules/identity/src/index.ts',
      'shared-packages-import-no-module: packages/game-sdk/src/host.ts → packages/modules/chat/src/index.ts',
      'shared-packages-import-no-module: packages/ui/src/avatar.ts → packages/modules/identity/src/index.ts',
    ]);
  });

  it('fails one app importing another, and a package importing an app', async () => {
    expect(
      await violations({
        'apps/worker/src/jobs.ts': "import '../../web/src/env';\n",
        'apps/web/src/env.ts': leaf,
        'packages/modules/chat/src/send.ts': "import '../../../../apps/realtime/src/fanout';\n",
        'apps/realtime/src/fanout.ts': leaf,
      }),
    ).toEqual([
      'no-imports-between-apps: apps/worker/src/jobs.ts → apps/web/src/env.ts',
      'packages-import-no-app: packages/modules/chat/src/send.ts → apps/realtime/src/fanout.ts',
    ]);
  });

  it('fails a cycle', async () => {
    expect(
      await violations({
        'packages/modules/chat/src/a.ts': "import './b';\nexport const a = 1;\n",
        'packages/modules/chat/src/b.ts': "import './a';\nexport const b = 1;\n",
      }),
    ).toEqual(['no-circular: packages/modules/chat/src/a.ts → packages/modules/chat/src/b.ts']);
  });
});
