CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"trigger" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"worker_id" text,
	"progress" text,
	"pages_crawled" integer DEFAULT 0 NOT NULL,
	"issues_high" integer DEFAULT 0 NOT NULL,
	"issues_medium" integer DEFAULT 0 NOT NULL,
	"issues_low" integer DEFAULT 0 NOT NULL,
	"drafts_created" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"audit_id" uuid,
	"url" text NOT NULL,
	"field" text NOT NULL,
	"current_value" text,
	"proposed" text NOT NULL,
	"rationale" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"audit_id" uuid NOT NULL,
	"url" text NOT NULL,
	"code" text NOT NULL,
	"severity" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"audit_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"title" text,
	"description" text,
	"h1_count" integer,
	"words" integer,
	"schema_types" text,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"text_excerpt" text
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"website_id" uuid,
	"customer_id" text,
	"product_id" text,
	"status" text NOT NULL,
	"recurring_amount" integer,
	"currency" text,
	"next_billing_date" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"dodo_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"checkout_session_id" text,
	"subscription_id" text,
	"subscription_status" text,
	"product_id" text,
	"next_billing_date" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"latest_score" integer,
	"last_audit_at" timestamp with time zone,
	"next_audit_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audits_website_id_idx" ON "audits" USING btree ("website_id","queued_at");--> statement-breakpoint
CREATE INDEX "audits_status_idx" ON "audits" USING btree ("status","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "audits_one_open_per_website" ON "audits" USING btree ("website_id") WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "checkout_sessions_website_id_idx" ON "checkout_sessions" USING btree ("website_id","created_at");--> statement-breakpoint
CREATE INDEX "drafts_website_id_idx" ON "drafts" USING btree ("website_id","status");--> statement-breakpoint
CREATE INDEX "drafts_website_url_field_idx" ON "drafts" USING btree ("website_id","url","field");--> statement-breakpoint
CREATE INDEX "issues_audit_id_idx" ON "issues" USING btree ("audit_id","severity");--> statement-breakpoint
CREATE INDEX "pages_audit_id_idx" ON "pages" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_website_id_idx" ON "subscriptions" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "websites_user_url_key" ON "websites" USING btree ("user_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "websites_subscription_id_key" ON "websites" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "websites_due_idx" ON "websites" USING btree ("status","next_audit_at");