// CHK-18: the worker runs jobs added inside transactions (ADR-0008), checks payloads, retries and
// logs failures without payloads (D9), registers module cron items and stops gracefully.
import { Writable } from 'node:stream';

import { createLogger } from '@chaku/adapters/log';
import {
  addJob,
  defineJob,
  handle,
  type ModuleJobs,
  payloadProblems,
  transaction,
} from '@chaku/db';
import { useTestDatabase } from '@chaku/db/testing';
import { deleteExpiredSessions } from '@chaku/identity';
import type { Runner } from 'graphile-worker';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { modules } from '../src/modules.ts';
import { buildCronItems, startWorker } from '../src/runner.ts';

const database = useTestDatabase();

const memberId = '01969c1e-0000-7000-8000-00000000abcd';
const seen: string[] = [];
let failNext = false;
let releaseSlow: () => void = () => undefined;

const noted = defineJob(
  'test.noted',
  z.object({ memberId: z.uuid(), label: z.enum(['a', 'b', 'sentinel']) }),
);
const slow = defineJob('test.slow', z.object({}));

const fixture: ModuleJobs = {
  handlers: [
    handle(noted, ({ label }) => {
      if (failNext) {
        failNext = false;
        throw new Error('the handler failed');
      }
      seen.push(label);
      return Promise.resolve();
    }),
    handle(slow, async () => {
      seen.push('slow started');
      await new Promise<void>((resolve) => (releaseSlow = resolve));
      seen.push('slow finished');
    }),
  ],
};

let output = '';
let runner: Runner | undefined;

async function start(): Promise<Runner> {
  output = '';
  const destination = new Writable({
    write(chunk, _, done) {
      output += String(chunk);
      done();
    },
  });
  const log = createLogger({ level: 'debug', destination });
  runner = await startWorker({
    db: database.db,
    log,
    modules: [fixture],
    concurrency: 2,
    pollInterval: 100,
  });
  return runner;
}

async function until(check: () => boolean | Promise<boolean>, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function jobRow(name: string) {
  const { rows } = await database.db.$client.query<{
    attempts: number;
    run_at: Date;
    last_error: string;
  }>(
    `select attempts, run_at, last_error from graphile_worker._private_jobs j
     join graphile_worker._private_tasks t on t.id = j.task_id where t.identifier = $1`,
    [name],
  );
  return rows[0];
}

afterEach(async () => {
  releaseSlow();
  await runner?.stop();
  runner = undefined;
  seen.length = 0;
  failNext = false;
});

describe('the worker', () => {
  it('runs a job added in a committed transaction, never one whose transaction rolled back', async () => {
    await start();
    await expect(
      transaction(database.db, async (scope) => {
        await addJob(scope, noted, { memberId, label: 'a' });
        throw new Error('the change failed');
      }),
    ).rejects.toThrow('the change failed');
    await transaction(database.db, async (scope) => {
      await addJob(scope, noted, { memberId, label: 'b' });
    });
    await until(() => seen.includes('b'));
    expect(seen).toEqual(['b']);
  });

  it('fails a stored payload that does not match, without calling the handler', async () => {
    await start();
    await database.db.$client.query(
      `select graphile_worker.add_job('test.noted', '{"memberId": "secret-free-text", "label": "a"}')`,
    );
    await until(async () => Boolean((await jobRow('test.noted'))?.last_error));
    expect(seen).toEqual([]);
    expect((await jobRow('test.noted'))?.last_error).toMatch(/memberId \(invalid_format\)/);
    expect(output).not.toContain('secret-free-text');
  });

  it('retries a failing job later and logs its name, ID and attempt but not its payload', async () => {
    await start();
    failNext = true;
    await transaction(database.db, async (scope) => {
      await addJob(scope, noted, { memberId, label: 'a' });
    });
    await until(async () => Boolean((await jobRow('test.noted'))?.last_error));
    const row = await jobRow('test.noted');
    expect(row?.run_at.getTime()).toBeGreaterThan(Date.now());
    const line = output.split('\n').find((text) => text.includes('Job failed'));
    expect(JSON.parse(line ?? '{}')).toMatchObject({
      job: 'test.noted',
      jobId: expect.any(String) as unknown,
      attempt: 1,
      msg: 'Job failed; it will be retried',
    });
    expect(output).not.toContain(memberId);
  });

  it('finishes the running job before stop() resolves', async () => {
    const started = await start();
    await transaction(database.db, async (scope) => {
      await addJob(scope, slow, {});
    });
    await until(() => seen.includes('slow started'));
    const stopping = started.stop();
    setTimeout(() => {
      releaseSlow();
    }, 200);
    await stopping;
    await started.promise;
    runner = undefined;
    expect(seen).toEqual(['slow started', 'slow finished']);
    // The job is marked complete on its way out; nothing runs it again.
    await until(async () => (await jobRow('test.slow')) === undefined);
  });
});

describe('registered modules', () => {
  it("put identity's cron item from its public entry into the crontab", () => {
    expect(buildCronItems(modules)).toMatchObject([
      { task: deleteExpiredSessions.name, identifier: deleteExpiredSessions.name },
    ]);
  });

  it('carry IDs and small values only in every payload', () => {
    for (const module of modules) {
      for (const { job } of module.handlers) expect(payloadProblems(job.payload)).toEqual([]);
    }
  });

  it('refuse a cron item without a handler', () => {
    expect(() =>
      buildCronItems([{ handlers: [], cron: [{ job: slow, match: '* * * * *' }] }]),
    ).toThrow(/no handler/);
  });
});
