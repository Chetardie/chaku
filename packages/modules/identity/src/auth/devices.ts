// Login devices (D21): a long-lived random cookie names the device, and `login_devices` stores only
// its SHA-256. A login from a device the Member hasn't used before adds the new-device alert job,
// in the same transaction as the new device row (ADR-0008).
import { createHash, randomBytes } from 'node:crypto';

import { addJob, type TransactionScope } from '@chaku/db';
import { and, eq, ne, sql } from 'drizzle-orm';

import { newDeviceAlert } from '../jobs.ts';
import { loginDevices } from '../schema.ts';

export const deviceCookieName = 'chaku_device';

/** About 400 days: the longest a browser keeps a cookie. */
export const deviceCookieMaxAge = 400 * 24 * 60 * 60;

export function newDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export function deviceHash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

const browsers: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const systems: [RegExp, string][] = [
  [/\bWindows\b/, 'Windows'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
  [/\bLinux\b/, 'Linux'],
];

/**
 * "Firefox · Windows": browser and system names read the same in English and Ukrainian, so the
 * label is stored once. `''` when the User-Agent names neither; the screens and emails then say
 * "unknown device" in the reader's language.
 */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const browser = browsers.find(([pattern]) => pattern.test(ua))?.[1];
  const system = systems.find(([pattern]) => pattern.test(ua))?.[1];
  return [browser, system].filter(Boolean).join(' · ');
}

export interface RecordedDevice {
  id: string;
  /** This device hadn't logged in to this Member before. */
  isNew: boolean;
  /** The alert job was added: a new device, and not the Member's first one. */
  alerted: boolean;
}

/**
 * Records a login from the device whose cookie is `token`, inside `scope`'s transaction. A new
 * device adds the alert job, unless it is the Member's first device: a brand-new Member gets no
 * alert for their first login.
 */
export async function recordLoginDevice(
  scope: TransactionScope,
  memberId: string,
  token: string,
  label: string,
): Promise<RecordedDevice> {
  const hash = deviceHash(token);
  const [row] = await scope.tx
    .insert(loginDevices)
    .values({ memberId, deviceHash: hash, label, firstSeenAt: sql`now()`, lastSeenAt: sql`now()` })
    .onConflictDoUpdate({
      target: [loginDevices.memberId, loginDevices.deviceHash],
      set: { lastSeenAt: sql`now()`, label },
    })
    // `xmax = 0` only on a row this statement inserted.
    .returning({ id: loginDevices.id, isNew: sql<boolean>`xmax = 0` });
  if (!row) throw new Error('Recording the login device returned no row.');
  if (!row.isNew) return { id: row.id, isNew: false, alerted: false };

  const [other] = await scope.tx
    .select({ id: loginDevices.id })
    .from(loginDevices)
    .where(and(eq(loginDevices.memberId, memberId), ne(loginDevices.id, row.id)))
    .limit(1);
  if (!other) return { id: row.id, isNew: true, alerted: false };

  await addJob(scope, newDeviceAlert, { loginDeviceId: row.id });
  return { id: row.id, isNew: true, alerted: true };
}
