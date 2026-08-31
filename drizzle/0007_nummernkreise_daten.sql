-- Bestandsdaten in die neue Nummernlogik überführen.
--
-- Bisher hiessen die Nummern "RE-2026-0001". Der entsprechende Nummernkreis
-- ist alles vor der laufenden Nummer, also "RE-2026-". Damit bleiben bereits
-- vergebene Nummern gültig und der Zähler zählt in ihrem Kreis weiter.

UPDATE "invoices"
   SET "number_scope" = 'RE-' || "number_year"::text || '-'
 WHERE "number" IS NOT NULL AND "number_scope" IS NULL;
--> statement-breakpoint

INSERT INTO "invoice_number_counters" ("scope", "last_seq")
SELECT 'RE-' || "year"::text || '-', "last_seq" FROM "invoice_counters"
ON CONFLICT ("scope") DO NOTHING;
--> statement-breakpoint

-- Bestehende Schüler:innen bekommen fortlaufende Kundennummern. Ab der
-- hundertsten Person bleibt die Nummer leer und muss von Hand vergeben werden -
-- zweistellig ist zweistellig.
WITH nummeriert AS (
  SELECT "id", row_number() OVER (ORDER BY "id") AS nr FROM "students"
)
UPDATE "students" s
   SET "customer_number" = n.nr
  FROM nummeriert n
 WHERE s."id" = n."id" AND n.nr <= 99 AND s."customer_number" IS NULL;
