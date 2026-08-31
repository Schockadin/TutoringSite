CREATE TABLE "lesson_series" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_series_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"until_date" date NOT NULL,
	"time_local" text NOT NULL,
	"interval_weeks" integer DEFAULT 1 NOT NULL,
	"duration_minutes" integer NOT NULL,
	"subject" text,
	"location" text,
	"tariff_id" integer,
	"price_cents" integer,
	"billable" boolean DEFAULT true NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_series_interval" CHECK ("lesson_series"."interval_weeks" between 1 and 8),
	CONSTRAINT "lesson_series_duration" CHECK ("lesson_series"."duration_minutes" between 1 and 600),
	CONSTRAINT "lesson_series_range" CHECK ("lesson_series"."until_date" >= "lesson_series"."start_date"),
	CONSTRAINT "lesson_series_time" CHECK ("lesson_series"."time_local" ~ '^[0-2][0-9]:[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_amounts";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "series_id" integer;--> statement-breakpoint
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_series_student_idx" ON "lesson_series" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "lessons_series_idx" ON "lessons" USING btree ("series_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts" CHECK ("invoices"."cancels_invoice_id" is not null or ("invoices"."net_cents" >= 0 and "invoices"."total_cents" >= 0));--> statement-breakpoint

-- Drizzle kann die Referenz nicht ausdruecken, weil lessons vor lesson_series
-- definiert ist. SET NULL ist hier bewusst gewaehlt: wird eine Serie beendet
-- und geloescht, duerfen bereits abgerechnete Stunden nicht mitgeloescht
-- werden - sie verlieren nur ihre Zugehoerigkeit.
ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_series_fk"
  FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE TRIGGER lesson_series_set_updated_at BEFORE UPDATE ON "lesson_series"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
