// identity's jobs (ADR-0008). apps/worker runs them; they reach it through src/index.ts. Payloads
// are IDs only: the alert emails read the address and the device from the database, so no address
// sits in the queue (D9).
import type { EmailSender } from '@chaku/adapters/email';
import { defineJob, handle, type ModuleJobs } from '@chaku/db';
import { eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { formatEmailTime, isEmailLocale } from './emails/messages.ts';
import { emailChangedEmail, newDeviceEmail } from './emails/templates.ts';
import { emailChanges, loginDevices, members, sessions } from './schema.ts';

/** Every hour: deletes sessions that expired (D21, ADR-0008). */
export const deleteExpiredSessions = defineJob('identity.delete_expired_sessions', z.object({}));

/** A login from a device the Member hadn't used before (D21). */
export const newDeviceAlert = defineJob(
  'identity.new_device_alert',
  z.object({ loginDeviceId: z.uuid() }),
);

/** The Member's email changed: tell the old address (D37). */
export const emailChangeAlert = defineJob(
  'identity.email_change_alert',
  z.object({ emailChangeId: z.uuid() }),
);

export interface IdentityJobDependencies {
  email: EmailSender;
}

/** identity's handlers and schedules, for apps/worker. */
export function identityJobs({ email }: IdentityJobDependencies): ModuleJobs {
  return {
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

      // A retry after the email went out sends it again: an alert twice beats none.
      handle(newDeviceAlert, async ({ loginDeviceId }, { db, log }) => {
        const [device] = await db
          .select({
            label: loginDevices.label,
            firstSeenAt: loginDevices.firstSeenAt,
            email: members.email,
            locale: members.locale,
          })
          .from(loginDevices)
          .innerJoin(members, eq(members.id, loginDevices.memberId))
          .where(eq(loginDevices.id, loginDeviceId));
        if (!device) {
          // The device or its Member is gone (logged out, erased): nobody to tell.
          log.info({ loginDeviceId }, 'Login device gone; no alert');
          return;
        }
        const locale = isEmailLocale(device.locale) ? device.locale : 'en';
        await email.send(
          await newDeviceEmail({
            to: device.email,
            locale,
            device: device.label,
            time: formatEmailTime(device.firstSeenAt, locale),
          }),
        );
      }),

      // The row goes once the email is sent, so a second run finds nothing to do.
      handle(emailChangeAlert, async ({ emailChangeId }, { db, log }) => {
        const [change] = await db
          .select({
            oldEmail: emailChanges.oldEmail,
            changedAt: emailChanges.changedAt,
            locale: members.locale,
          })
          .from(emailChanges)
          .innerJoin(members, eq(members.id, emailChanges.memberId))
          .where(eq(emailChanges.id, emailChangeId));
        if (!change) {
          log.info({ emailChangeId }, 'Email change already alerted');
          return;
        }
        const locale = isEmailLocale(change.locale) ? change.locale : 'en';
        await email.send(
          await emailChangedEmail({
            to: change.oldEmail,
            locale,
            time: formatEmailTime(change.changedAt, locale),
          }),
        );
        await db.delete(emailChanges).where(eq(emailChanges.id, emailChangeId));
      }),
    ],
    cron: [{ job: deleteExpiredSessions, match: '17 * * * *' }],
  };
}
