// Every read and write the web app makes (D50). One namespace per module, each procedure calling
// the module's public entry point; business logic stays in the modules (ADR-0003). Module
// namespaces arrive with their tickets.
import { listSessions, revokeOtherSessions, revokeSession } from '@chaku/identity';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { database } from '../db.ts';
import { base, memberProcedure } from './context.ts';

export const router = {
  health: {
    /** The server is up and reaches Postgres. Shown on the home page until the app has screens. */
    check: base.handler(async () => {
      await database().execute(sql`select 1`);
      return { status: 'ok' as const };
    }),
  },
  identity: {
    /** The sessions page (D21): my sessions, logging one out, logging out everywhere else. */
    sessions: {
      list: memberProcedure.handler(({ context }) =>
        listSessions(database(), context.session.memberId, context.session.sessionId),
      ),
      /** `NOT_FOUND` when it isn't one of mine (D9: the same answer for both). */
      revoke: memberProcedure
        .input(z.object({ sessionId: z.uuid() }))
        .handler(async ({ context, input, errors }) => {
          const revoked = await revokeSession(
            database(),
            context.session.memberId,
            input.sessionId,
          );
          if (!revoked) throw errors.NOT_FOUND();
          return { revoked: true as const };
        }),
      revokeOthers: memberProcedure.handler(async ({ context }) => ({
        revoked: await revokeOtherSessions(
          database(),
          context.session.memberId,
          context.session.sessionId,
        ),
      })),
    },
  },
};

export type Router = typeof router;
