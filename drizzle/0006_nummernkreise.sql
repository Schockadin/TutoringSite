CREATE TABLE "invoice_number_counters" (
	"scope" text PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_number_counters_seq" CHECK ("invoice_number_counters"."last_seq" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "number_scope" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "invoice_number_template" text DEFAULT '{INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "customer_number" integer;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "invoice_number_template" text;--> statement-breakpoint
CREATE UNIQUE INDEX "students_customer_number_key" ON "students" USING btree ("customer_number");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_customer_number" CHECK ("students"."customer_number" is null or "students"."customer_number" between 0 and 99);