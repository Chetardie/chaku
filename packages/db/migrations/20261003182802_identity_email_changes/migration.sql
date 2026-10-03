CREATE TABLE "identity"."email_changes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"member_id" uuid NOT NULL,
	"old_email" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_changes_member_idx" ON "identity"."email_changes" ("member_id");--> statement-breakpoint
ALTER TABLE "identity"."email_changes" ADD CONSTRAINT "email_changes_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "identity"."members"("id") ON DELETE CASCADE;