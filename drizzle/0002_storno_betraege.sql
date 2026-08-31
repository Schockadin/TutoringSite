-- Stornorechnungen tragen negative Betraege: die Positionen sind die negierten
-- Positionen der Originalrechnung, und die Summe muss dazu passen. Sonst zeigt
-- der Ausdruck negative Zeilen unter einer positiven Endsumme.
--
-- Fuer regulaere Rechnungen bleibt die Untergrenze bei 0 bestehen, damit ein
-- Rabatt nicht versehentlich eine Rechnung ins Minus zieht.
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_amounts";
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts" CHECK (
  "cancels_invoice_id" IS NOT NULL
  OR ("net_cents" >= 0 AND "total_cents" >= 0)
);
