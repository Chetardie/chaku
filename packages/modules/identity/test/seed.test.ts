// CHK-17: the local seed has fake Members only, an Admin and a few Members in an invite tree,
// with reserved email domains and no real people or emails (D23, ADR-0013).
import { createHash } from 'node:crypto';

import { useTestDatabase } from '@chaku/db/testing';
import { asc } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { invites, members } from '../src/schema.ts';
import { seedIdentity, seedOpenInviteCode } from '../src/seed.ts';

const database = useTestDatabase();

beforeEach(async () => {
  await seedIdentity(database.db);
});

/** example.com (RFC 2606) or any name under the reserved .test top-level domain. */
const reservedDomain = /@(example\.com|([a-z0-9-]+\.)*[a-z0-9-]+\.test)$/;

describe('the identity seed', () => {
  it('uses only reserved email domains', async () => {
    const rows = await database.db.select({ email: members.email }).from(members);
    expect(rows.length).toBeGreaterThan(0);
    for (const { email } of rows) expect(email).toMatch(reservedDomain);
  });

  it('has one Admin and a few Members', async () => {
    const rows = await database.db
      .select({ role: members.role, status: members.status })
      .from(members);
    expect(rows.filter((row) => row.role === 'admin')).toHaveLength(1);
    expect(rows.filter((row) => row.role === 'member').length).toBeGreaterThanOrEqual(3);
    expect(rows.every((row) => row.status === 'active')).toBe(true);
  });

  it('joins everyone but the Admin into the invite tree through an Invite of their inviter', async () => {
    const people = await database.db.select().from(members).orderBy(asc(members.createdAt));
    const sent = await database.db.select().from(invites);
    for (const member of people) {
      if (member.role === 'admin') {
        expect(member.inviteId).toBeNull();
        continue;
      }
      const invite = sent.find((row) => row.id === member.inviteId);
      expect(invite, member.username ?? '').toBeDefined();
      expect(invite?.createdById).toBe(member.invitedById);
    }
    // At least two levels below the Admin, so the tree is a tree and not a star.
    const invitedByMembers = people.filter((m) =>
      people.some((inviter) => inviter.id === m.invitedById && inviter.role === 'member'),
    );
    expect(invitedByMembers.length).toBeGreaterThan(0);
  });

  it('counts each Invite as many times as it was used', async () => {
    const people = await database.db.select().from(members);
    for (const invite of await database.db.select().from(invites)) {
      const used = people.filter((member) => member.inviteId === invite.id).length;
      expect(invite.useCount).toBe(used);
    }
  });

  it('leaves one open Invite whose code is known for trying signup', async () => {
    const hash = createHash('sha256').update(seedOpenInviteCode).digest();
    const open = (await database.db.select().from(invites)).filter(
      (invite) => invite.useCount < invite.maxUses && invite.expiresAt > new Date(),
    );
    expect(open).toHaveLength(1);
    expect(Buffer.compare(Buffer.from(open[0]?.codeHash ?? []), hash)).toBe(0);
  });
});
