CREATE SCHEMA "mcp_safety_candidate";
--> statement-breakpoint
CREATE TABLE "mcp_safety_candidate"."editorial_commands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"expected_version" bigint,
	"expected_digest" text,
	"payload" jsonb NOT NULL,
	"proof_ref" text,
	"slot_key" text,
	"due_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"state" text NOT NULL,
	"receipt" jsonb,
	"cache_state" text DEFAULT 'pending' NOT NULL,
	"cache_attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_command_kind_check" CHECK ("mcp_safety_candidate"."editorial_commands"."kind" in ('draft','publish')),
	CONSTRAINT "editorial_command_state_check" CHECK ("mcp_safety_candidate"."editorial_commands"."state" in ('prepared','queued','done','blocked','uncertain')),
	CONSTRAINT "editorial_cache_state_check" CHECK ("mcp_safety_candidate"."editorial_commands"."cache_state" in ('pending','done'))
);
--> statement-breakpoint
CREATE TABLE "mcp_safety_candidate"."editorial_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"target_post_id" uuid,
	"version" bigint NOT NULL,
	"content" jsonb NOT NULL,
	"digest" text NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_drafts_owner_id_key" UNIQUE("owner_id","id"),
	CONSTRAINT "editorial_drafts_version_check" CHECK ("mcp_safety_candidate"."editorial_drafts"."version">0),
	CONSTRAINT "editorial_drafts_digest_check" CHECK (length("mcp_safety_candidate"."editorial_drafts"."digest")=64)
);
--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_commands" ADD CONSTRAINT "editorial_commands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_commands" ADD CONSTRAINT "editorial_commands_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_commands" ADD CONSTRAINT "editorial_commands_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_commands" ADD CONSTRAINT "editorial_commands_owner_id_draft_id_editorial_drafts_owner_id_id_fk" FOREIGN KEY ("owner_id","draft_id") REFERENCES "mcp_safety_candidate"."editorial_drafts"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_drafts" ADD CONSTRAINT "editorial_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_drafts" ADD CONSTRAINT "editorial_drafts_target_post_id_blog_posts_id_fk" FOREIGN KEY ("target_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_drafts" ADD CONSTRAINT "editorial_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_safety_candidate"."editorial_drafts" ADD CONSTRAINT "editorial_drafts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_command_request_idx" ON "mcp_safety_candidate"."editorial_commands" USING btree ("owner_id","kind","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_slot_unique" ON "mcp_safety_candidate"."editorial_commands" USING btree ("owner_id","slot_key") WHERE "mcp_safety_candidate"."editorial_commands"."slot_key" is not null;--> statement-breakpoint
CREATE INDEX "editorial_drafts_owner_post_idx" ON "mcp_safety_candidate"."editorial_drafts" USING btree ("owner_id","target_post_id");