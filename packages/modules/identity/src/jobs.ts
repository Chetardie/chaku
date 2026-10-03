// identity's jobs (ADR-0008). apps/worker runs them; they reach it through src/index.ts.
import { defineJob, handle, type ModuleJobs } from '@chaku/db';
import { lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { sessions } from './schema.ts';

/** Every hour: deletes sessions that expired (D21, ADR-0008). */
export const deleteExpiredSessions = defineJob('identity.delete_expired_sessions', z.object({}));

export const identityJobs: ModuleJobs = {
  handlers: [
    // Deleting what has expired leaves the same rows however often it runs, so a second run
    // after a crash or retry changes nothing.
    handle(deleteExpiredSessions, async (_, { db, log }) => {
      const deleted = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, sql`now()`))
        .returning({ id: sessions.id });
      log.info({ deleted: deleted.length }, 'Deleted expired sessions');
    }),
  ],
  cron: [{ job: deleteExpiredSessions, match: '17 * * * *' }],
};
