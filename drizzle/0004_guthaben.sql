CREATE TABLE "credit_packages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_packages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"total_units" integer,
	"unit_duration_minutes" integer,
	"credit_cents" integer,
	"price_cents" integer NOT NULL,
	"purchased_on" date NOT NULL,
	"paid_on" date,
	"expires_on" date,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packages_kind" CHECK ("credit_packages"."kind" in ('units','amount')),
	CONSTRAINT "credit_packages_label" CHECK (length(btrim("credit_packages"."label")) between 1 and 120),
	CONSTRAINT "credit_packages_price" CHECK ("credit_packages"."price_cents" >= 0),
	CONSTRAINT "credit_packages_units_fields" CHECK ("credit_packages"."kind" <> 'units' or ("credit_packages"."total_units" > 0 and "credit_packages"."unit_duration_minutes" between 1 and 600 and "credit_packages"."credit_cents" is null)),
	CONSTRAINT "credit_packages_amount_fields" CHECK ("credit_packages"."kind" <> 'amount' or ("credit_packages"."credit_cents" > 0 and "credit_packages"."total_units" is null and "credit_packages"."unit_duration_minutes" is null)),
	CONSTRAINT "credit_packages_expiry" CHECK ("credit_packages"."expires_on" is null or "credit_packages"."expires_on" >= "credit_packages"."purchased_on")
);
--> statement-breakpoint
CREATE TABLE "credit_redemptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"package_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"units_used" integer DEFAULT 0 NOT NULL,
	"cents_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_redemptions_amounts" CHECK ("credit_redemptions"."units_used" >= 0 and "credit_redemptions"."cents_used" >= 0),
	CONSTRAINT "credit_redemptions_nonzero" CHECK ("credit_redemptions"."units_used" > 0 or "credit_redemptions"."cents_used" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "package_id" integer;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_redemptions" ADD CONSTRAINT "credit_redemptions_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_redemptions" ADD CONSTRAINT "credit_redemptions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_packages_student_idx" ON "credit_packages" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_redemptions_lesson_key" ON "credit_redemptions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "credit_redemptions_package_idx" ON "credit_redemptions" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_package_key" ON "invoice_items" USING btree ("package_id") WHERE "invoice_items"."package_id" is not null;--> statement-breakpoint

-- Drizzle kann die Referenz nicht ausdruecken, weil invoice_items vor
-- credit_packages definiert ist. RESTRICT: ein Guthabenpaket, das auf einer
-- Rechnung steht, darf nicht verschwinden.
ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_package_fk"
  FOREIGN KEY ("package_id") REFERENCES "credit_packages"("id") ON DELETE RESTRICT;
--> statement-breakpoint

CREATE TRIGGER credit_packages_set_updated_at BEFORE UPDATE ON "credit_packages"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Eine Position muss sich auf genau eine Sache beziehen: eine Stunde, ein
-- Guthabenpaket oder nichts von beidem (freie Zeile wie Fahrtkosten).
ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_one_reference"
  CHECK (NOT ("lesson_id" IS NOT NULL AND "package_id" IS NOT NULL));
