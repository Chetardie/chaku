-- Hand-written before drizzle-kit's output (CHK-17): the extensions people search and Post search
-- use (D33), and identity.unaccent_lower, which members_display_name_trgm_idx needs. `unaccent`
-- alone isn't immutable, so it can't be used in an index; this wrapper names its dictionary.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE FUNCTION identity.unaccent_lower(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, lower($1));
--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"member_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "accounts_password_check" CHECK ("password" is null)
);
--> statement-breakpoint
CREATE TABLE "identity"."blocks" (
	"blocker_id" uuid,
	"blocked_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "blocks_pkey" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "blocks_self_check" CHECK ("blocker_id" <> "blocked_id")
);
--> statement-breakpoint
CREATE TABLE "identity"."export_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"member_id" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code_hash" bytea NOT NULL,
	"created_by_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"max_uses" integer NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invites_kind_check" CHECK ("kind" in ('single', 'multi')),
	CONSTRAINT "invites_max_uses_check" CHECK ("max_uses" >= 1 and ("kind" = 'multi' or "max_uses" = 1)),
	CONSTRAINT "invites_use_count_check" CHECK ("use_count" >= 0 and "use_count" <= "max_uses")
);
--> statement-breakpoint
CREATE TABLE "identity"."jwks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"alg" text,
	"crv" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."login_devices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"member_id" uuid NOT NULL,
	"device_hash" bytea NOT NULL,
	"label" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"display_name" text NOT NULL,
	"provider_image_url" text,
	"username" text,
	"username_changed_at" timestamp with time zone,
	"avatar_upload_id" uuid,
	"role" text DEFAULT 'member' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"status" text NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"invite_id" uuid,
	"invited_by_id" uuid,
	"invites_left" smallint DEFAULT 5 NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" text,
	"locale" text,
	"share_read_receipts" boolean DEFAULT true NOT NULL,
	"share_presence" boolean DEFAULT true NOT NULL,
	"last_seen_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "members_email_check" CHECK ("email" = lower("email")),
	CONSTRAINT "members_display_name_check" CHECK (char_length("display_name") <= 50 and ("display_name" <> '' or "status" in ('onboarding', 'erased'))),
	CONSTRAINT "members_username_check" CHECK ("username" ~ '^[a-z0-9_]{3,20}$'),
	CONSTRAINT "members_role_check" CHECK ("role" in ('member', 'admin')),
	CONSTRAINT "members_status_check" CHECK ("status" in ('onboarding', 'active', 'deletion_requested', 'erased')),
	CONSTRAINT "members_locale_check" CHECK ("locale" in ('en', 'uk')),
	CONSTRAINT "members_invites_left_check" CHECK ("invites_left" >= 0)
);
--> statement-breakpoint
CREATE TABLE "identity"."passkeys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"member_id" uuid NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" bigint NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"token" text NOT NULL,
	"member_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"auth_method" text NOT NULL,
	"login_device_id" uuid,
	"impersonated_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_auth_method_check" CHECK ("auth_method" in ('google', 'email_code', 'email_link', 'passkey'))
);
--> statement-breakpoint
CREATE TABLE "identity"."verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "identity"."accounts" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_member_idx" ON "identity"."accounts" ("member_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "identity"."blocks" ("blocked_id");--> statement-breakpoint
CREATE INDEX "export_requests_open_idx" ON "identity"."export_requests" ("requested_at") WHERE "delivered_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_key" ON "identity"."invites" ("code_hash");--> statement-breakpoint
CREATE INDEX "invites_created_by_idx" ON "identity"."invites" ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "login_devices_member_device_key" ON "identity"."login_devices" ("member_id","device_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_key" ON "identity"."members" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "members_username_key" ON "identity"."members" ("username");--> statement-breakpoint
CREATE INDEX "members_username_trgm_idx" ON "identity"."members" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "members_display_name_trgm_idx" ON "identity"."members" USING gin (identity.unaccent_lower("display_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "members_invited_by_idx" ON "identity"."members" ("invited_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_key" ON "identity"."passkeys" ("credential_id");--> statement-breakpoint
CREATE INDEX "passkeys_member_idx" ON "identity"."passkeys" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "identity"."sessions" ("token");--> statement-breakpoint
CREATE INDEX "sessions_member_idx" ON "identity"."sessions" ("member_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "identity"."sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "identity"."verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "identity"."accounts" ADD CONSTRAINT "accounts_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."blocks" ADD CONSTRAINT "blocks_blocker_id_members_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "identity"."members"("id");--> statement-breakpoint
ALTER TABLE "identity"."blocks" ADD CONSTRAINT "blocks_blocked_id_members_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "identity"."members"("id");--> statement-breakpoint
ALTER TABLE "identity"."export_requests" ADD CONSTRAINT "export_requests_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id");--> statement-breakpoint
ALTER TABLE "identity"."invites" ADD CONSTRAINT "invites_created_by_id_members_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "identity"."members"("id");--> statement-breakpoint
ALTER TABLE "identity"."login_devices" ADD CONSTRAINT "login_devices_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."members" ADD CONSTRAINT "members_invite_id_invites_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "identity"."invites"("id");--> statement-breakpoint
ALTER TABLE "identity"."members" ADD CONSTRAINT "members_invited_by_id_members_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "identity"."members"("id");--> statement-breakpoint
ALTER TABLE "identity"."passkeys" ADD CONSTRAINT "passkeys_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_login_device_id_login_devices_id_fkey" FOREIGN KEY ("login_device_id") REFERENCES "identity"."login_devices"("id");