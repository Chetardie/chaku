// CHK-19: the environment is validated with Zod when the server starts (D23, ADR-0011). A bad value
// stops startup with a message that names the variable and never shows the value.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import { InvalidEnvError, parseServerEnv, serverEnvSchema } from '../src/env.ts';
import { checkEnvironment } from '../src/server/startup.ts';
import { repoRoot } from './setup.ts';

const example = parseEnv(readFileSync(path.join(repoRoot, '.env.example'), 'utf8'));

describe('.env.example', () => {
  it('passes the schema', () => {
    expect(() => parseServerEnv(example)).not.toThrow();
  });

  it('has every variable in the schema', () => {
    const optional = ['NODE_ENV']; // set by Next.js itself
    const missing = Object.keys(serverEnvSchema.shape).filter(
      (name) => !optional.includes(name) && !(name in example),
    );
    expect(missing).toEqual([]);
  });
});

describe('parseServerEnv', () => {
  const secret = 'postgres-password-3e9a';

  it('names a missing variable', () => {
    const withoutDatabase = Object.fromEntries(
      Object.entries(example).filter(([name]) => name !== 'DATABASE_URL'),
    );
    expect(() => parseServerEnv(withoutDatabase)).toThrow(/DATABASE_URL is not set/);
  });

  it('names an invalid variable without showing its value', () => {
    let message = '';
    try {
      parseServerEnv({ ...example, DATABASE_URL: `mysql://chaku:${secret}@db/chaku` });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvError);
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL is invalid/);
    expect(message).not.toContain(secret);
  });

  it('lists every problem at once', () => {
    expect(() => parseServerEnv({ ...example, APP_URL: 'not a url', SMTP_URL: '' })).toThrow(
      /APP_URL is invalid[\s\S]*SMTP_URL is not set/,
    );
  });

  it('takes realtime origins only over WebSockets', () => {
    expect(() =>
      parseServerEnv({ ...example, REALTIME_URL: 'https://rt.chaku.localhost' }),
    ).toThrow(/REALTIME_URL is invalid/);
  });
});

describe('checkEnvironment (instrumentation.ts register)', () => {
  it('stops the server with exit code 1 when the environment is invalid', () => {
    const exit = vi.fn<(code: number) => never>();
    const report = vi.fn<(message: string) => void>();
    checkEnvironment({ ...example, S3_SECRET_ACCESS_KEY: '' }, exit, report);
    expect(exit).toHaveBeenCalledWith(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining('S3_SECRET_ACCESS_KEY is not set'));
  });

  it('lets a valid environment through', () => {
    const exit = vi.fn<(code: number) => never>();
    checkEnvironment(example, exit, vi.fn());
    expect(exit).not.toHaveBeenCalled();
  });
});
