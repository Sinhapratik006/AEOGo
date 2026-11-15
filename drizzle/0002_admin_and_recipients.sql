ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "audit_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "audit_recipients_email_key" ON "audit_recipients" USING btree ("email");--> statement-breakpoint
UPDATE "users" SET "is_admin" = true WHERE "email" = 'sinhapratik0004@gmail.com';
