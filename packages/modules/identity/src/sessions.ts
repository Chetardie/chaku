// The sessions page (D21): a Member's own sessions, and logging them out remotely. Sessions are
// named by ID here; their tokens never leave the server.
import type { Queryable } from '@chaku/db';
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';

import type { AuthMethod } from './auth/auth.ts';
import { loginDevices, sessions } from './schema.ts';

export interface MemberSession {
  id: string;
  /** "Firefox · Windows"; `''` when the device is unknown. */
  deviceLabel: string;
  authMethod: AuthMethod;
  /** The session was last extended (at most daily) or created. */
  lastActiveAt: Date;
  createdAt: Date;
  /** The session this request uses. */
  current: boolean;
}

/** The Member's live sessions, most recently active first. */
export async function listSessions(
  db: Queryable,
  memberId: string,
  currentSessionId: string,
): Promise<MemberSession[]> {
  const rows = await db
    .select({
      id: sessions.id,
      deviceLabel: loginDevices.label,
      authMethod: sessions.authMethod,
      lastActiveAt: sessions.updatedAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .leftJoin(loginDevices, eq(loginDevices.id, sessions.loginDeviceId))
    .where(and(eq(sessions.memberId, memberId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.updatedAt), desc(sessions.id));
  return rows.map((row) => ({
    ...row,
    deviceLabel: row.deviceLabel ?? '',
    authMethod: row.authMethod as AuthMethod,
    current: row.id === currentSessionId,
  }));
}

/** Ends one of the Member's sessions. False when the Member has no such session. */
export async function revokeSession(
  db: Queryable,
  memberId: string,
  sessionId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.memberId, memberId)))
    .returning({ id: sessions.id });
  return deleted.length > 0;
}

/** "Log out everywhere else": ends every session of the Member but the current one. */
export async function revokeOtherSessions(
  db: Queryable,
  memberId: string,
  currentSessionId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.memberId, memberId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id });
  return deleted.length;
}
