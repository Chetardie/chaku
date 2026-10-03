// CHK-18: identity's jobs, run the way apps/worker runs them (ADR-0008).
import { queuedJobs, runJob, useTestDatabase } from '@chaku/db/testing';
import { asc } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { deleteExpiredSessions, identityJobs } from '../src/index.ts';
import { members, sessions } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';

const database = useTestDatabase();

const hour = 60 * 60 * 1000;

beforeEach(async () => {
  await seedIdentity(database.db);
  const [member] = await database.db.select({ id: members.id }).from(members).limit(1);
  if (!member) throw new Error('The seed has no Member.');
  const session = (token: string, expiresAt: Date) => ({
    token,
    memberId: member.id,
    expiresAt,
    authMethod: 'email_code',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await database.db
    .insert(sessions)
    .values([
      session('expired-yesterday', new Date(Date.now() - 24 * hour)),
      session('expired-an-hour-ago', new Date(Date.now() - hour)),
      session('live', new Date(Date.now() + 30 * 24 * hour)),
    ]);
});

async function tokens(): Promise<string[]> {
  const rows = await database.db
    .select({ token: sessions.token })
    .from(sessions)
    .orderBy(asc(sessions.token));
  return rows.map((row) => row.token);
}

describe('identity.delete_expired_sessions', () => {
  it('deletes the expired sessions and keeps the live ones', async () => {
    await runJob(database.db, identityJobs, deleteExpiredSessions, {});
    expect(await tokens()).toEqual(['live']);
  });

  it('leaves the same state when it runs twice', async () => {
    await runJob(database.db, identityJobs, deleteExpiredSessions, {});
    const once = await tokens();
    await runJob(database.db, identityJobs, deleteExpiredSessions, {}, 2);
    expect(await tokens()).toEqual(once);
  });

  it('runs every hour and adds no other job', async () => {
    expect(identityJobs.cron).toEqual([{ job: deleteExpiredSessions, match: '17 * * * *' }]);
    await runJob(database.db, identityJobs, deleteExpiredSessions, {});
    expect(await queuedJobs(database.db)).toEqual([]);
  });
});
