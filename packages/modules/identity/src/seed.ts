// The fixed local seed (D23): fake Members only, with reserved example.com addresses, never real
// people or emails (ADR-0013). IDs and times are fixed too, so `pnpm db:reset` always gives the
// same data. The invite tree:
//
//   Admin ── multi-use Invite ──┬─ Alice ── Invite ── Chen
//                               └─ Bohdan ── Invite ── Daryna ── open Invite (unused)
import { createHash } from 'node:crypto';

import type { Queryable } from '@chaku/db';

import { invites, members } from './schema.ts';

/** UUIDv7-shaped fixed IDs: the time part is 2026-01-01, the random part counts up. */
const seedId = (n: number) => `019b76da-a800-7000-8000-${n.toString(16).padStart(12, '0')}`;

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

/** The code in the open Invite's link, for trying signup locally. Only its hash is stored. */
export const seedOpenInviteCode = 'seed-open-invite';

const codeHash = (code: string) => createHash('sha256').update(code).digest();

const ids = {
  admin: seedId(1),
  alice: seedId(2),
  bohdan: seedId(3),
  chen: seedId(4),
  daryna: seedId(5),
  adminInvite: seedId(101),
  aliceInvite: seedId(102),
  bohdanInvite: seedId(103),
  darynaInvite: seedId(104),
};

const member = (
  id: string,
  username: string,
  displayName: string,
  joined: Date,
  extra: Partial<typeof members.$inferInsert> = {},
): typeof members.$inferInsert => ({
  id,
  email: `${username}@example.com`,
  emailVerified: true,
  displayName,
  username,
  status: 'active',
  ageConfirmedAt: joined,
  termsAcceptedAt: joined,
  termsVersion: '2026-01-01',
  createdAt: joined,
  updatedAt: joined,
  ...extra,
});

export const seedMembers: (typeof members.$inferInsert)[] = [
  member(ids.admin, 'admin', 'Admin', day(1), { role: 'admin' }),
  member(ids.alice, 'alice', 'Alice', day(2), {
    inviteId: ids.adminInvite,
    invitedById: ids.admin,
    invitesLeft: 4,
  }),
  member(ids.bohdan, 'bohdan', 'Bohdan', day(2), {
    inviteId: ids.adminInvite,
    invitedById: ids.admin,
    invitesLeft: 4,
    locale: 'uk',
  }),
  member(ids.chen, 'chen', 'Chen', day(3), {
    inviteId: ids.aliceInvite,
    invitedById: ids.alice,
    locale: 'en',
  }),
  member(ids.daryna, 'daryna', 'Daryna', day(4), {
    inviteId: ids.bohdanInvite,
    invitedById: ids.bohdan,
    invitesLeft: 4,
    locale: 'uk',
  }),
];

export const seedInvites: (typeof invites.$inferInsert)[] = [
  {
    id: ids.adminInvite,
    codeHash: codeHash('seed-admin-invite'),
    createdById: ids.admin,
    kind: 'multi',
    maxUses: 10,
    useCount: 2,
    expiresAt: day(31),
    createdAt: day(1),
  },
  {
    id: ids.aliceInvite,
    codeHash: codeHash('seed-alice-invite'),
    createdById: ids.alice,
    kind: 'single',
    maxUses: 1,
    useCount: 1,
    expiresAt: day(9),
    createdAt: day(2),
  },
  {
    id: ids.bohdanInvite,
    codeHash: codeHash('seed-bohdan-invite'),
    createdById: ids.bohdan,
    kind: 'single',
    maxUses: 1,
    useCount: 1,
    expiresAt: day(10),
    createdAt: day(3),
  },
  {
    // Far in the future, so it stays open on every machine.
    id: ids.darynaInvite,
    codeHash: codeHash(seedOpenInviteCode),
    createdById: ids.daryna,
    kind: 'single',
    maxUses: 1,
    useCount: 0,
    expiresAt: new Date(Date.UTC(2100, 0, 1)),
    createdAt: day(5),
  },
];

/** Inserts the seed. Members and Invites point at each other, so the Admin goes first. */
export async function seedIdentity(db: Queryable): Promise<void> {
  const [admin, ...invited] = seedMembers;
  if (admin) await db.insert(members).values(admin);
  await db.insert(invites).values(seedInvites.slice(0, 1));
  for (const row of invited) {
    await db.insert(members).values(row);
    const ownInvite = seedInvites.find((invite) => invite.createdById === row.id);
    if (ownInvite) await db.insert(invites).values(ownInvite);
  }
}
