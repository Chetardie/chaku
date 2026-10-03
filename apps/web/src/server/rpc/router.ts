// Every read and write the web app makes (D50). One namespace per module, each procedure calling
// the module's public entry point; business logic stays in the modules (ADR-0003). Module
// namespaces arrive with their tickets.
import { sql } from 'drizzle-orm';

import { database } from '../db.ts';
import { base } from './context.ts';

export const router = {
  health: {
    /** The server is up and reaches Postgres. Shown on the home page until the app has screens. */
    check: base.handler(async () => {
      await database().execute(sql`select 1`);
      return { status: 'ok' as const };
    }),
  },
};

export type Router = typeof router;
