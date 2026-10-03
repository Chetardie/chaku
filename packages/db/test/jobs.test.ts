// CHK-18: jobs are defined with a payload of IDs only and added inside the transaction of the
// change, so the queue is the outbox (ADR-0008, D9).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  addJob,
  defineJob,
  InvalidJobError,
  InvalidJobPayloadError,
  payloadProblems,
} from '../src/jobs.ts';
import { queuedJobs, useTestDatabase } from '../src/testing/index.ts';
import { transaction } from '../src/transaction.ts';

const database = useTestDatabase();

const memberId = '01969c1e-0000-7000-8000-000000000001';
const chatId = '01969c1e-0000-7000-8000-000000000002';

const readPositionMoved = defineJob(
  'chat.read_position_moved',
  z.object({ chatId: z.uuid(), memberId: z.uuid(), readSeq: z.int().nonnegative() }),
);

describe('defineJob', () => {
  it('accepts a payload of IDs, enums, numbers, booleans and timestamps', () => {
    const job = defineJob(
      'media.upload_processed',
      z.object({
        uploadId: z.uuid(),
        kind: z.enum(['image', 'avatar']),
        target: z.object({ module: z.literal('chat'), id: z.uuid() }),
        participantIds: z.array(z.uuid()),
        width: z.number().optional(),
        ready: z.boolean(),
        processedAt: z.iso.datetime().nullable(),
      }),
    );
    expect(job.name).toBe('media.upload_processed');
  });

  it.each([
    ['a plain string', z.object({ body: z.string() })],
    ['an email', z.object({ to: z.email() })],
    ['a list of strings', z.object({ names: z.array(z.string()) })],
    ['a nested string', z.object({ message: z.object({ id: z.uuid(), text: z.string() }) })],
    ['anything', z.object({ data: z.unknown() })],
    ['a map of strings', z.object({ data: z.record(z.uuid(), z.string()) })],
    ['extra fields', z.looseObject({ id: z.uuid() })],
  ])('rejects a payload with %s', (_, payload) => {
    expect(() => defineJob('chat.message_created', payload)).toThrow(InvalidJobError);
    expect(payloadProblems(payload).length).toBeGreaterThan(0);
  });

  it('names the field that could carry free text', () => {
    expect(
      payloadProblems(z.object({ message: z.object({ id: z.uuid(), text: z.string() }) })),
    ).toEqual(['message.text: free text (use a UUID, an enum or a timestamp)']);
  });

  it.each(['chat', 'Chat.MessageCreated', 'chat.message-created', 'chat.message.created'])(
    'rejects the name %s',
    (name) => {
      expect(() => defineJob(name, z.object({}))).toThrow(InvalidJobError);
    },
  );
});

describe('addJob', () => {
  it('adds the job when the transaction commits', async () => {
    const runAt = new Date('2030-01-01T00:00:00Z');
    await transaction(database.db, async (scope) => {
      await addJob(
        scope,
        readPositionMoved,
        { chatId, memberId, readSeq: 7 },
        { runAt, jobKey: `read:${memberId}:${chatId}`, maxAttempts: 5, priority: 1 },
      );
    });
    expect(await queuedJobs(database.db)).toEqual([
      {
        name: 'chat.read_position_moved',
        payload: { chatId, memberId, readSeq: 7 },
        runAt,
        jobKey: `read:${memberId}:${chatId}`,
        maxAttempts: 5,
        priority: 1,
        attempts: 0,
      },
    ]);
  });

  it('uses the defaults when no options are given', async () => {
    await transaction(database.db, async (scope) => {
      await addJob(scope, readPositionMoved, { chatId, memberId, readSeq: 1 });
    });
    expect(await queuedJobs(database.db)).toMatchObject([
      { jobKey: null, maxAttempts: 25, priority: 0, attempts: 0 },
    ]);
  });

  it('never stores a job whose transaction rolls back', async () => {
    const failing = transaction(database.db, async (scope) => {
      await addJob(scope, readPositionMoved, { chatId, memberId, readSeq: 7 });
      throw new Error('the change failed');
    });
    await expect(failing).rejects.toThrow('the change failed');
    expect(await queuedJobs(database.db)).toEqual([]);
  });

  it('leaves one job for a burst with the same key, with the newest payload', async () => {
    for (const readSeq of [1, 2, 3]) {
      await transaction(database.db, async (scope) => {
        await addJob(scope, readPositionMoved, { chatId, memberId, readSeq }, { jobKey: 'k' });
      });
    }
    expect(await queuedJobs(database.db)).toMatchObject([
      { payload: { chatId, memberId, readSeq: 3 } },
    ]);
  });

  it('throws on a payload that does not match, naming the field but not its value', async () => {
    const adding = transaction(database.db, async (scope) => {
      // @ts-expect-error readSeq must be a number
      await addJob(scope, readPositionMoved, { chatId, memberId: 'not-a-uuid', readSeq: 'x' });
    });
    await expect(adding).rejects.toThrow(InvalidJobPayloadError);
    await expect(adding).rejects.toThrow(/memberId \(invalid_format\), readSeq \(invalid_type\)/);
    await expect(adding).rejects.not.toThrow(/not-a-uuid/);
    expect(await queuedJobs(database.db)).toEqual([]);
  });

  it('takes a defined job, not a name', async () => {
    const adding = transaction(database.db, async (scope) => {
      // @ts-expect-error a job name alone is not a job
      await addJob(scope, 'chat.read_position_moved', { chatId, memberId, readSeq: 1 });
    });
    await expect(adding).rejects.toThrow(InvalidJobError);
    expect(await queuedJobs(database.db)).toEqual([]);
  });
});
