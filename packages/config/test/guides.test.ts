// CHK-28: the conventions and testing guides point at real files, their code samples are real code,
// what isn't built yet names its ticket, every test layer says how to run it and which CI job
// does, and the docs people read first link both guides without broken links.
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n');

const guides = ['docs/guides/conventions.md', 'docs/guides/testing.md'];

/** The docs that must link both guides, and the link each one uses. */
const linkedFrom = [
  ['docs/README.md', 'guides/'],
  ['CONTRIBUTING.md', 'docs/guides/'],
  ['CLAUDE.md', 'docs/guides/'],
] as const;

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens. */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replaceAll(/\s/g, '-');
}

/** The text outside fenced code blocks. */
const prose = (text: string) => text.replaceAll(/^```[\s\S]*?^```$/gm, '');

function anchors(text: string): Set<string> {
  const seen = new Map<string, number>();
  const result = new Set<string>();
  for (const [, heading = ''] of prose(text).matchAll(/^#{1,6} (.+)$/gm)) {
    const base = slug(heading);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${String(count)}`);
  }
  return result;
}

/** Relative links in a Markdown file that don't lead to a file, folder or heading. */
function brokenLinks(file: string): string[] {
  const text = read(file);
  const broken: string[] = [];
  for (const [, target = ''] of prose(text).matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const [pathPart = '', anchor] = target.split('#');
    const resolved = pathPart ? path.join(path.dirname(file), pathPart) : file;
    if (!existsSync(path.join(root, resolved))) {
      broken.push(`${target} (no such file)`);
      continue;
    }
    if (anchor === undefined) continue;
    const isMarkdown = statSync(path.join(root, resolved)).isFile() && resolved.endsWith('.md');
    if (isMarkdown && !anchors(read(resolved)).has(anchor)) {
      broken.push(`${target} (no such heading)`);
    }
  }
  return broken;
}

interface Sample {
  language: string;
  code: string;
  /** The line right above the block. */
  intro: string;
}

function samples(text: string): Sample[] {
  return [...text.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].map((match) => {
    const before = text.slice(0, match.index).trimEnd().split('\n');
    return { language: match[1] ?? '', code: match[2] ?? '', intro: before.at(-1) ?? '' };
  });
}

/** Rows of the table right under `## <heading>`, without the header and separator. */
function tableUnder(text: string, heading: string): string[][] {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`no "## ${heading}" heading`);
  const lines = text.slice(start).split('\n');
  const first = lines.findIndex((line) => line.startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines.slice(first + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

const backticked = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');

interface PackageJson {
  name: string;
  scripts?: Record<string, string>;
}

const packages = new Map(
  globSync(
    ['package.json', '{apps,packages,packages/modules}/*/package.json', 'stack/package.json'],
    {
      cwd: root,
    },
  ).map((file) => {
    const json = JSON.parse(read(file)) as PackageJson;
    return [json.name, json] as const;
  }),
);

/** Why a `pnpm …` command from a guide wouldn't run, or `undefined` when it would. */
function commandProblem(command: string): string | undefined {
  const words = command.split(/\s+/).slice(1);
  let target = packages.get('chaku');
  if (words[0] === '--filter') {
    target = packages.get(words[1] ?? '');
    if (!target) return `no package ${words[1] ?? ''}`;
    words.splice(0, 2);
  }
  const [script = ''] = words;
  if (['exec', 'install'].includes(script)) return undefined;
  // Binaries the root installs, run as `pnpm <bin>`.
  if (target?.name === 'chaku' && script === 'turbo') return undefined;
  return target?.scripts?.[script] === undefined
    ? `${target?.name ?? '?'} has no script "${script}"`
    : undefined;
}

const ciJobs = Object.keys(
  (parse(read('.github/workflows/ci.yml')) as { jobs: Record<string, unknown> }).jobs,
);

describe.each(guides)('%s', (guide) => {
  const text = read(guide);

  it('has no broken relative links, so every claim leads to a file', () => {
    expect(brokenLinks(guide)).toEqual([]);
  });

  it('takes every code sample from the file named right above it, unchanged', () => {
    const blocks = samples(text);
    expect(blocks.length).toBeGreaterThan(0);
    for (const { language, code, intro } of blocks) {
      expect(['ts', 'tsx'], `a sample in ${language || 'no language'}`).toContain(language);
      const source = /^From \[`([^`]+)`\]\(([^)]+)\):$/.exec(intro);
      expect(source, `"From [\`file\`](link):" above:\n${code}`).not.toBeNull();
      const [, file = '', link = ''] = source ?? [];
      expect(path.join(path.dirname(guide), link)).toBe(path.normalize(file));
      expect(read(file), `the sample from ${file}`).toContain(code);
    }
  });

  it('names the ticket, or says there is none yet, wherever something is planned', () => {
    for (const match of text.matchAll(/Planned/g)) {
      const rest = text.slice(match.index - 1);
      if (rest.startsWith('_Planned_ with the ticket')) continue;
      const marker = /^_Planned \(([^)]*)\)\.?_/.exec(rest);
      expect(marker, `a _Planned (…)_ marker at: ${rest.slice(0, 60)}`).not.toBeNull();
      expect(marker?.[1]).toMatch(/CHK-\d+|no ticket yet/);
    }
  });

  it('gives only commands that exist', () => {
    const commands = backticked(prose(text)).filter((code) => code.startsWith('pnpm '));
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) expect(commandProblem(command), command).toBeUndefined();
  });

  it.each(linkedFrom)('is linked from %s', (file, prefix) => {
    expect(read(file)).toContain(`](${prefix}${path.basename(guide)}`);
  });
});

describe('the testing guide', () => {
  const rows = tableUnder(read('docs/guides/testing.md'), 'Layers');

  it('covers every layer from D19', () => {
    const layers = rows.map(([layer]) => layer);
    for (const layer of ['Unit', 'Module', 'Contract', 'End-to-end', 'Component accessibility']) {
      expect(layers).toContain(layer);
    }
  });

  it('says how to run each built layer locally and which CI job runs it', () => {
    for (const [layer = '', , files = '', local = '', job = ''] of rows) {
      if (files.includes('_Planned')) continue;
      expect(local, `how to run ${layer} locally`).not.toBe('');
      const jobs = backticked(job);
      expect(jobs, `the CI job of ${layer}`).toHaveLength(1);
      expect(ciJobs).toContain(jobs[0]);
    }
  });

  it('places every CI job but the gate in the table', () => {
    const named = new Set(rows.flatMap(([, , , , job = '']) => backticked(job)));
    for (const job of ciJobs.filter((name) => name !== 'ci')) expect(named).toContain(job);
  });
});

describe('the docs people read first', () => {
  it.each(linkedFrom.map(([file]) => file))('%s has no broken relative links', (file) => {
    expect(brokenLinks(file)).toEqual([]);
  });

  it('the docs index lists both guides as written', () => {
    const index = read('docs/README.md');
    for (const guide of guides) {
      // Its own row in "All repo docs" starts with the link; the role table only mentions it.
      const link = `](${path.relative('docs', guide).replaceAll('\\', '/')})`;
      const row = index
        .split('\n')
        .find((line) => /^\| \[[^\]]+\]\(/.test(line) && line.includes(link));
      expect(row, guide).toMatch(/\| current/);
    }
  });
});
