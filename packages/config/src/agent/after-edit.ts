// Claude Code's PostToolUse hooks after Edit and Write (CHK-24), wired in .claude/settings.json:
//
//   node packages/config/src/agent/after-edit.ts format      Prettier on the edited file, before
//                                                            the next edit sees it
//   node packages/config/src/agent/after-edit.ts typecheck   `tsc` in the edited file's package,
//                                                            in the background
//
// Claude Code passes the tool call as JSON on stdin. Markdown is formatted by hand (.prettierignore)
// and has no types, so editing it runs neither. Neither hook blocks an edit: formatting problems
// are left to the type check and lint, and a failing type check exits 2, which wakes Claude with
// the errors (`asyncRewake`).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import * as prettier from 'prettier';

/** The repo this script belongs to. */
export const repoRoot = path.resolve(import.meta.dirname, '../../../..');

/** Formatted by hand: Prettier re-pads tables (.prettierignore says so too). */
const handFormatted = new Set(['.md', '.mdx']);

/** Files `tsc` checks. */
const typed = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Generated or installed: never formatted or checked from here. */
const generated = /(^|[\\/])(node_modules|dist|\.next|\.turbo|coverage)([\\/]|$)/;

/** The edited file from a PostToolUse hook's input, or undefined for another tool. */
export function editedFile(input: unknown): string | undefined {
  const file = (input as { tool_input?: { file_path?: unknown } } | null)?.tool_input?.file_path;
  return typeof file === 'string' && file !== '' ? path.resolve(file) : undefined;
}

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function wanted(file: string, root: string): boolean {
  return inside(root, file) && !generated.test(path.relative(root, file));
}

/** Whether the format hook should look at `file`. Prettier then applies .prettierignore. */
export function shouldFormat(file: string, root = repoRoot): boolean {
  return wanted(file, root) && !handFormatted.has(path.extname(file).toLowerCase());
}

/**
 * The workspace package whose type check covers `file`: the nearest folder with a package.json
 * whose `typecheck` script runs `tsc`. The root's script runs Turborepo instead, so a file that
 * belongs to no package is not checked.
 */
export function typecheckPackage(file: string, root = repoRoot): string | undefined {
  if (!wanted(file, root) || !typed.has(path.extname(file).toLowerCase())) return undefined;
  for (let dir = path.dirname(file); inside(root, dir); dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const { scripts } = JSON.parse(readFileSync(manifest, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return /^tsc(\s|$)/.test(scripts?.['typecheck'] ?? '') ? dir : undefined;
  }
  return undefined;
}

/** Formats `file` in place with the repo's Prettier config. Returns whether it changed. */
export async function formatFile(file: string, root = repoRoot): Promise<boolean> {
  if (!shouldFormat(file, root) || !existsSync(file)) return false;
  const info = await prettier.getFileInfo(file, {
    ignorePath: [path.join(root, '.prettierignore')],
    resolveConfig: true,
  });
  if (info.ignored || info.inferredParser === null) return false;
  const source = readFileSync(file, 'utf8');
  const options = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, { ...options, filepath: file });
  if (formatted === source) return false;
  writeFileSync(file, formatted);
  return true;
}

/** TypeScript 7's `tsc`, as the package's own `typecheck` script would find it. */
function tscEntry(packageDir: string): string {
  for (const from of [path.join(packageDir, 'package.json'), import.meta.filename]) {
    try {
      const manifest = createRequire(from).resolve('@typescript/native/package.json');
      return path.join(path.dirname(manifest), 'bin', 'tsc');
    } catch {
      // Not installed for that package; try the next place.
    }
  }
  throw new Error('TypeScript 7 (@typescript/native) is not installed. Run pnpm install.');
}

export interface TypecheckResult {
  ok: boolean;
  output: string;
}

/** Runs `tsc` in `packageDir`, the same check as `pnpm typecheck` there. */
export function typecheck(packageDir: string): TypecheckResult {
  const result = spawnSync(process.execPath, [tscEntry(packageDir), '--pretty', 'false'], {
    cwd: packageDir,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const output = `${result.stdout}${result.stderr}`.trim();
  return { ok: result.status === 0, output: output || (result.error?.message ?? '') };
}

/** At most this many lines of `tsc` output reach Claude; the rest are counted. */
const shownLines = 30;

/** Runs one hook. Returns the exit code; a failed type check exits 2 and explains on stderr. */
export async function afterEdit(
  mode: string,
  input: unknown,
  root = repoRoot,
  stderr: (text: string) => void = (text) => process.stderr.write(text),
): Promise<number> {
  const file = editedFile(input);
  if (!file) return 0;
  if (mode === 'format') {
    try {
      await formatFile(file, root);
    } catch (error) {
      // A syntax error, say. The type check reports it; the edit stands.
      stderr(`Prettier skipped ${path.relative(root, file)}: ${(error as Error).message}\n`);
    }
    return 0;
  }
  if (mode === 'typecheck') {
    const packageDir = typecheckPackage(file, root);
    if (!packageDir) return 0;
    const { ok, output } = typecheck(packageDir);
    if (ok) return 0;
    const lines = output.split(/\r?\n/);
    const more = lines.length > shownLines ? `\n… ${String(lines.length - shownLines)} more` : '';
    const where = path.relative(root, packageDir).split(path.sep).join('/');
    stderr(
      `The type check of ${where} fails after editing ${path.basename(file)}:\n` +
        `${lines.slice(0, shownLines).join('\n')}${more}\n`,
    );
    return 2;
  }
  stderr(`Usage: after-edit.ts <format|typecheck>, with the hook input on stdin.\n`);
  return 1;
}

async function readStdin(): Promise<unknown> {
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

if (import.meta.main) {
  process.exitCode = await afterEdit(process.argv[2] ?? '', await readStdin());
}
