// The `identity` schema: Members, login (Better Auth), Invites and Blocks. Every table, column, check
// and index here is listed in docs/architecture/data-model.md#identity, and test/schema.test.ts
// compares the migrated database with that doc.
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  bytea,
  check,
  date,
  index,
  integer,
  primaryKey,
  smallint,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const identity = snakeCase.schema('identity');

/** `id uuid` primary key, made by the database so IDs sort by creation time (ADR-0011). */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const timestamptz = () => timestamp({ withTimezone: true });

/** One row per Member, kept as a tombstone after erasure. Better Auth's `user` model. */
export const members = identity.table(
  'members',
  {
    id: id(),
    email: text().notNull(),
    emailVerified: boolean().notNull(),
    displayName: text().notNull(),
    providerImageUrl: text(),
    username: text(),
    usernameChangedAt: timestamptz(),
    avatarUploadId: uuid(),
    role: text().notNull().default('member'),
    banned: boolean().notNull().default(false),
    banReason: text(),
    banExpires: timestamptz(),
    status: text().notNull(),
    deletionRequestedAt: timestamptz(),
    inviteId: uuid().references((): AnyPgColumn => invites.id),
    invitedById: uuid().references((): AnyPgColumn => members.id),
    invitesLeft: smallint().notNull().default(5),
    ageConfirmedAt: timestamptz(),
    termsAcceptedAt: timestamptz(),
    termsVersion: text(),
    locale: text(),
    shareReadReceipts: boolean().notNull().default(true),
    sharePresence: boolean().notNull().default(true),
    lastSeenOn: date(),
    createdAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamptz().notNull(),
  },
  (t) => [
    uniqueIndex('members_email_key').on(t.email),
    uniqueIndex('members_username_key').on(t.username),
    index('members_username_trgm_idx').using('gin', t.username.op('gin_trgm_ops')),
    index('members_display_name_trgm_idx').using(
      'gin',
      sql`identity.unaccent_lower(${t.displayName}) gin_trgm_ops`,
    ),
    index('members_invited_by_idx').on(t.invitedById),
    check('members_email_check', sql`${t.email} = lower(${t.email})`),
    check(
      'members_display_name_check',
      sql`char_length(${t.displayName}) <= 50 and (${t.displayName} <> '' or ${t.status} in ('onboarding', 'erased'))`,
    ),
    check('members_username_check', sql`${t.username} ~ '^[a-z0-9_]{3,20}$'`),
    check('members_role_check', sql`${t.role} in ('member', 'admin')`),
    check(
      'members_status_check',
      sql`${t.status} in ('onboarding', 'active', 'deletion_requested', 'erased')`,
    ),
    check('members_locale_check', sql`${t.locale} in ('en', 'uk')`),
    check('members_invites_left_check', sql`${t.invitesLeft} >= 0`),
  ],
);

/** Better Auth sessions, 30 days, extended while in use (D21). */
export const sessions = identity.table(
  'sessions',
  {
    id: id(),
    token: text().notNull(),
    memberId: uuid()
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    expiresAt: timestamptz().notNull(),
    ipAddress: text(),
    userAgent: text(),
    authMethod: text().notNull(),
    loginDeviceId: uuid().references(() => loginDevices.id),
    impersonatedBy: text(),
    createdAt: timestamptz().notNull(),
    updatedAt: timestamptz().notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.token),
    index('sessions_member_idx').on(t.memberId),
    index('sessions_expires_idx').on(t.expiresAt),
    check(
      'sessions_auth_method_check',
      sql`${t.authMethod} in ('google', 'email_code', 'email_link', 'passkey')`,
    ),
  ],
);

/** Better Auth login connections: one per Google account. There are no passwords (ADR-0004). */
export const accounts = identity.table(
  'accounts',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    providerId: text().notNull(),
    accountId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamptz(),
    refreshTokenExpiresAt: timestamptz(),
    scope: text(),
    password: text(),
    createdAt: timestamptz().notNull(),
    updatedAt: timestamptz().notNull(),
  },
  (t) => [
    uniqueIndex('accounts_provider_account_key').on(t.providerId, t.accountId),
    index('accounts_member_idx').on(t.memberId),
    check('accounts_password_check', sql`${t.password} is null`),
  ],
);

/** Better Auth's short-lived values: email login codes and email change codes. */
export const verifications = identity.table(
  'verifications',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamptz().notNull(),
    createdAt: timestamptz().notNull(),
    updatedAt: timestamptz().notNull(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/** `@better-auth/passkey`. */
export const passkeys = identity.table(
  'passkeys',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    name: text(),
    publicKey: text().notNull(),
    credentialId: text().notNull(),
    counter: bigint({ mode: 'number' }).notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    aaguid: text(),
    createdAt: timestamptz(),
  },
  (t) => [
    uniqueIndex('passkeys_credential_key').on(t.credentialId),
    index('passkeys_member_idx').on(t.memberId),
  ],
);

/** Signing keys of the JWT plugin for Game identity tokens (ADR-0004). No Member data. */
export const jwks = identity.table('jwks', {
  id: id(),
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  alg: text(),
  crv: text(),
  createdAt: timestamptz().notNull(),
  expiresAt: timestamptz(),
});

/** Devices a Member has logged in from, for the new-device email alert (D21). */
export const loginDevices = identity.table(
  'login_devices',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    deviceHash: bytea().notNull(),
    label: text().notNull(),
    firstSeenAt: timestamptz().notNull(),
    lastSeenAt: timestamptz().notNull(),
  },
  (t) => [uniqueIndex('login_devices_member_device_key').on(t.memberId, t.deviceHash)],
);

export const invites = identity.table(
  'invites',
  {
    id: id(),
    codeHash: bytea().notNull(),
    createdById: uuid()
      .notNull()
      .references((): AnyPgColumn => members.id),
    kind: text().notNull(),
    maxUses: integer().notNull(),
    useCount: integer().notNull().default(0),
    expiresAt: timestamptz().notNull(),
    revokedAt: timestamptz(),
    createdAt: timestamptz().notNull(),
  },
  (t) => [
    uniqueIndex('invites_code_key').on(t.codeHash),
    index('invites_created_by_idx').on(t.createdById),
    check('invites_kind_check', sql`${t.kind} in ('single', 'multi')`),
    check(
      'invites_max_uses_check',
      sql`${t.maxUses} >= 1 and (${t.kind} = 'multi' or ${t.maxUses} = 1)`,
    ),
    check('invites_use_count_check', sql`${t.useCount} >= 0 and ${t.useCount} <= ${t.maxUses}`),
  ],
);

export const blocks = identity.table(
  'blocks',
  {
    blockerId: uuid()
      .notNull()
      .references(() => members.id),
    blockedId: uuid()
      .notNull()
      .references(() => members.id),
    createdAt: timestamptz().notNull(),
  },
  (t) => [
    primaryKey({ name: 'blocks_pkey', columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked_idx').on(t.blockedId),
    check('blocks_self_check', sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

/** Data export requests from Settings, delivered by an Admin within 30 days (D37). */
export const exportRequests = identity.table(
  'export_requests',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id),
    requestedAt: timestamptz().notNull(),
    deliveredAt: timestamptz(),
  },
  (t) => [
    index('export_requests_open_idx')
      .on(t.requestedAt)
      .where(sql`${t.deliveredAt} is null`),
  ],
);
