CREATE TABLE "invoice_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_counters_seq" CHECK ("invoice_counters"."last_seq" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"lesson_id" integer,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"service_date" date,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'Einheit' NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_quantity" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_description" CHECK (length(btrim("invoice_items"."description")) > 0),
	CONSTRAINT "invoice_items_amount" CHECK ("invoice_items"."amount_cents" = "invoice_items"."quantity" * "invoice_items"."unit_price_cents")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"number" text,
	"number_year" integer,
	"number_seq" integer,
	"issue_date" date,
	"due_date" date,
	"service_period_start" date,
	"service_period_end" date,
	"issuer_name" text,
	"issuer_address" text,
	"issuer_email" text,
	"issuer_phone" text,
	"issuer_tax_number" text,
	"issuer_vat_id" text,
	"issuer_account_holder" text,
	"issuer_iban" text,
	"issuer_bic" text,
	"recipient_name" text,
	"recipient_address" text,
	"tax_mode" text,
	"tax_rate_bp" integer,
	"tax_note" text,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"intro_text" text,
	"footer_note" text,
	"paid_on" date,
	"cancelled_at" timestamp with time zone,
	"cancels_invoice_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_status" CHECK ("invoices"."status" in ('draft','open','paid','cancelled')),
	CONSTRAINT "invoices_number_when_final" CHECK (("invoices"."status" = 'draft') = ("invoices"."number" is null)),
	CONSTRAINT "invoices_issue_when_final" CHECK ("invoices"."status" = 'draft' or "invoices"."issue_date" is not null),
	CONSTRAINT "invoices_paid_fields" CHECK ("invoices"."status" <> 'paid' or "invoices"."paid_on" is not null),
	CONSTRAINT "invoices_total_consistent" CHECK ("invoices"."total_cents" = "invoices"."net_cents" + "invoices"."tax_cents"),
	CONSTRAINT "invoices_amounts" CHECK ("invoices"."net_cents" >= 0 and "invoices"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lessons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"subject" text,
	"location" text,
	"topic" text,
	"notes" text,
	"tariff_id" integer,
	"price_cents" integer,
	"billable" boolean DEFAULT true NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_duration" CHECK ("lessons"."duration_minutes" between 1 and 600),
	CONSTRAINT "lessons_status" CHECK ("lessons"."status" in ('planned','held','cancelled','no_show')),
	CONSTRAINT "lessons_price" CHECK ("lessons"."price_cents" is null or "lessons"."price_cents" >= 0),
	CONSTRAINT "lessons_price_required" CHECK ("lessons"."status" not in ('held','no_show') or not "lessons"."billable" or "lessons"."price_cents" is not null),
	CONSTRAINT "lessons_cancel_fields" CHECK (("lessons"."status" = 'cancelled') = ("lessons"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" "bytea" PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"issuer_name" text DEFAULT '' NOT NULL,
	"issuer_street" text DEFAULT '' NOT NULL,
	"issuer_postal_code" text DEFAULT '' NOT NULL,
	"issuer_city" text DEFAULT '' NOT NULL,
	"issuer_country" text DEFAULT 'DE' NOT NULL,
	"issuer_email" text DEFAULT '' NOT NULL,
	"issuer_phone" text DEFAULT '' NOT NULL,
	"tax_number" text DEFAULT '' NOT NULL,
	"vat_id" text DEFAULT '' NOT NULL,
	"tax_mode" text DEFAULT 'exempt_4_21' NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_note" text DEFAULT 'Umsatzsteuerbefreit gemäß § 4 Nr. 21 Buchst. b UStG.' NOT NULL,
	"bank_account_holder" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"bic" text DEFAULT '' NOT NULL,
	"payment_terms_days" integer DEFAULT 14 NOT NULL,
	"invoice_number_prefix" text DEFAULT 'RE' NOT NULL,
	"invoice_intro_text" text DEFAULT '' NOT NULL,
	"invoice_footer_note" text DEFAULT '' NOT NULL,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_tax_mode" CHECK ("settings"."tax_mode" in ('exempt_4_21','small_business_19','standard')),
	CONSTRAINT "settings_tax_rate" CHECK ("settings"."tax_rate_bp" between 0 and 10000),
	CONSTRAINT "settings_terms" CHECK ("settings"."payment_terms_days" between 0 and 365),
	CONSTRAINT "settings_duration" CHECK ("settings"."default_duration_minutes" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "students_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"grade" text,
	"school" text,
	"subjects" text[] DEFAULT '{}' NOT NULL,
	"student_email" text,
	"student_phone" text,
	"billing_name" text,
	"billing_email" text,
	"billing_phone" text,
	"billing_street" text,
	"billing_postal_code" text,
	"billing_city" text,
	"billing_country" text DEFAULT 'DE' NOT NULL,
	"default_tariff_id" integer,
	"hourly_rate_cents" integer,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_first_name" CHECK (length(btrim("students"."first_name")) between 1 and 100),
	CONSTRAINT "students_last_name" CHECK (length(btrim("students"."last_name")) between 1 and 100),
	CONSTRAINT "students_hourly_rate" CHECK ("students"."hourly_rate_cents" is null or "students"."hourly_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tariffs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tariffs_name_len" CHECK (length(btrim("tariffs"."name")) between 1 and 100),
	CONSTRAINT "tariffs_duration" CHECK ("tariffs"."duration_minutes" between 1 and 600),
	CONSTRAINT "tariffs_price" CHECK ("tariffs"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_default_tariff_id_tariffs_id_fk" FOREIGN KEY ("default_tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_position" ON "invoice_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_lesson_key" ON "invoice_items" USING btree ("lesson_id") WHERE "invoice_items"."lesson_id" is not null;--> statement-breakpoint
CREATE INDEX "invoices_student_idx" ON "invoices" USING btree ("student_id","issue_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_pair" ON "invoices" USING btree ("number_year","number_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_cancels_idx" ON "invoices" USING btree ("cancels_invoice_id") WHERE "invoices"."cancels_invoice_id" is not null;--> statement-breakpoint
CREATE INDEX "lessons_starts_idx" ON "lessons" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "lessons_student_starts_idx" ON "lessons" USING btree ("student_id","starts_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lessons_tariff_idx" ON "lessons" USING btree ("tariff_id");--> statement-breakpoint
CREATE INDEX "login_attempts_time_idx" ON "login_attempts" USING btree ("attempted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree (lower("last_name"),lower("first_name"));--> statement-breakpoint
CREATE INDEX "students_tariff_idx" ON "students" USING btree ("default_tariff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tariffs_name_key" ON "tariffs" USING btree (lower(btrim("name")));