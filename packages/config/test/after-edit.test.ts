// CHK-24: editing a .ts file in Claude Code runs Prettier on it and its package's type check;
// editing a .md file runs neither. A failing type check reports, it doesn't block.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  afterEdit,
  editedFile,
  repoRoot,
  shouldFormat,
  typecheckPackage,
} from '../src/agent/after-edit.ts';

const script = path.join(repoRoot, 'packages/config/src/agent/after-edit.ts');
const hookInput = (file: string) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Edit',
  tool_input: { file_path: file },
});

/** A workspace of one package, outside the repo so nothing else sees it. */
let root: string;
let pkg: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'chaku-after-edit-'));
  pkg = path.join(root, 'packages/scratch');
  mkdirSync(path.join(pkg, 'src'), { recursive: true });
  writeFileSync(
    path.join(root, 'package.json'),
    '{ "scripts": { "typecheck": "turbo run typecheck" } }',
  );
  writeFileSync(path.join(root, '.prettierignore'), '*.md\n');
  writeFileSync(path.join(pkg, 'package.json'), '{ "scripts": { "typecheck": "tsc" } }');
  writeFileSync(
    path.join(pkg, 'tsconfig.json'),
    '{ "compilerOptions": { "strict": true, "noEmit": true, "types": [] }, "include": ["src"] }',
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relative: string, text: string): string {
  const file = path.join(root, relative);
  writeFileSync(file, text);
  return file;
}

describe('which files the hooks look at', () => {
  it('reads the edited file from the hook input', () => {
    expect(editedFile(hookInput('a/b.ts'))).toBe(path.resolve('a/b.ts'));
    expect(editedFile({ tool_input: { command: 'ls' } })).toBeUndefined();
    expect(editedFile(undefined)).toBeUndefined();
  });

  it.each([
    ['packages/modules/identity/src/schema.ts', true, 'packages/modules/identity'],
    ['apps/web/app/page.tsx', true, 'apps/web'],
    ['stack/src/cli.ts', true, 'stack'],
    ['packages/config/eslint.js', true, 'packages/config'],
    ['.claude/settings.json', true, undefined],
    ['pnpm-workspace.yaml', true, undefined],
    ['prettier.config.js', true, undefined],
    ['docs/process/workflow.md', false, undefined],
    ['CLAUDE.md', false, undefined],
    ['apps/web/node_modules/next/index.js', false, undefined],
    ['apps/worker/dist/main.mjs', false, undefined],
  ])('%s: format %s, type check %s', (relative, format, packageDir) => {
    const file = path.join(repoRoot, relative);
    expect(shouldFormat(file)).toBe(format);
    expect(typecheckPackage(file)).toBe(packageDir && path.join(repoRoot, packageDir));
  });

  it('leaves files outside the project alone', () => {
    const outside = path.join(path.dirname(repoRoot), 'elsewhere', 'notes.ts');
    expect(shouldFormat(outside)).toBe(false);
    expect(typecheckPackage(outside)).toBeUndefined();
  });
});

describe('editing a .ts file', () => {
  it('formats it with Prettier', async () => {
    const file = write(
      'packages/scratch/src/greet.ts',
      'export const greet = (name:string)=>{return "hi "+name}\n',
    );
    expect(await afterEdit('format', hookInput(file), root)).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(
      'export const greet = (name: string) => {\n  return "hi " + name;\n};\n',
    );
  });

  it("type checks its package and passes quietly when it's fine", async () => {
    const file = write('packages/scratch/src/fine.ts', 'export const one: number = 1;\n');
    const messages: string[] = [];
    expect(await afterEdit('typecheck', hookInput(file), root, (m) => messages.push(m))).toBe(0);
    expect(messages).toEqual([]);
  });

  it('reports a failing type check with exit code 2, so Claude is woken with the errors', async () => {
    const file = write('packages/scratch/src/broken.ts', 'export const two: number = "two";\n');
    const messages: string[] = [];
    try {
      expect(await afterEdit('typecheck', hookInput(file), root, (m) => messages.push(m))).toBe(2);
    } finally {
      rmSync(file);
    }
    expect(messages.join('')).toMatch(
      /type check of packages\/scratch fails after editing broken\.ts/,
    );
    expect(messages.join('')).toMatch(/broken\.ts.*TS2322/);
  });
});

describe('editing a .md file', () => {
  it('runs neither Prettier nor a type check', async () => {
    const text = '| a |  b |\n|---|---|\n|  1 | 2 |\n';
    const file = write('packages/scratch/README.md', text);
    const messages: string[] = [];
    expect(await afterEdit('format', hookInput(file), root, (m) => messages.push(m))).toBe(0);
    expect(await afterEdit('typecheck', hookInput(file), root, (m) => messages.push(m))).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(text);
    expect(messages).toEqual([]);
    expect(typecheckPackage(file, root)).toBeUndefined();
  });
});

describe('the hook script', () => {
  it('reads the hook input from stdin, as Claude Code runs it', () => {
    const file = path.join(repoRoot, 'docs/process/workflow.md');
    const result = spawnSync(process.execPath, [script, 'typecheck'], {
      input: JSON.stringify(hookInput(file)),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
  });

  it('refuses an unknown mode without blocking anything', () => {
    const result = spawnSync(process.execPath, [script, 'lint'], {
      input: JSON.stringify(hookInput(path.join(repoRoot, 'package.json'))),
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
  });
});

describe('.claude/settings.json', () => {
  interface Hook {
    type: string;
    command: string;
    async?: boolean;
    asyncRewake?: boolean;
  }
  const settings = JSON.parse(
    readFileSync(path.join(repoRoot, '.claude/settings.json'), 'utf8'),
  ) as {
    hooks: { PostToolUse: { matcher: string; hooks: Hook[] }[] };
  };
  const afterEdits = settings.hooks.PostToolUse.filter((group) =>
    group.matcher.split('|').includes('Edit'),
  );
  const command = (mode: string) =>
    afterEdits.flatMap((group) => group.hooks).find((hook) => hook.command.endsWith(` ${mode}`));

  it('runs both hooks after Edit and Write', () => {
    expect(afterEdits).toHaveLength(1);
    expect(afterEdits[0]?.matcher.split('|')).toEqual(expect.arrayContaining(['Edit', 'Write']));
    for (const mode of ['format', 'typecheck']) {
      expect(command(mode)?.command).toBe(
        `node "$CLAUDE_PROJECT_DIR/packages/config/src/agent/after-edit.ts" ${mode}`,
      );
    }
  });

  it('formats before the next edit, and type checks in the background', () => {
    expect(command('format')?.async).toBeUndefined();
    expect(command('format')?.asyncRewake).toBeUndefined();
    expect(command('typecheck')?.asyncRewake).toBe(true);
  });
});
