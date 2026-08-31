CREATE TABLE "contact_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"notify_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_messages_status" CHECK ("contact_messages"."status" in ('new','read','archived')),
	CONSTRAINT "contact_messages_name" CHECK (length(btrim("contact_messages"."name")) between 1 and 120),
	CONSTRAINT "contact_messages_email" CHECK (length(btrim("contact_messages"."email")) between 3 and 200),
	CONSTRAINT "contact_messages_message" CHECK (length(btrim("contact_messages"."message")) between 1 and 5000)
);
--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");