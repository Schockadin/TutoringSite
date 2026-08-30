ALTER TABLE "invoice_counters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "invoice_counters" CASCADE;--> statement-breakpoint
DROP INDEX "invoices_number_pair";--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_pair" ON "invoices" USING btree ("number_scope","number_seq");--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "number_year";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "invoice_number_prefix";