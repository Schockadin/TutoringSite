-- Selbstreferenz fuer Stornorechnungen. Drizzle kann eine Fremdschluessel-
-- Selbstreferenz im Schema nicht zirkelfrei ausdruecken, deshalb hier von Hand.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_cancels_fk"
  FOREIGN KEY ("cancels_invoice_id") REFERENCES "invoices"("id") ON DELETE restrict;
--> statement-breakpoint

-- updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
--> statement-breakpoint

CREATE TRIGGER students_set_updated_at BEFORE UPDATE ON "students"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER lessons_set_updated_at BEFORE UPDATE ON "lessons"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON "settings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Unveraenderlichkeit abgerechneter Stunden.
--
-- Die Anwendung prueft das ebenfalls, aber als Trigger haelt die Regel auch,
-- wenn jemand mit psql an der Datenbank arbeitet. Fuer Buchungsdaten ist diese
-- Redundanz die Kosten wert.
--
-- Bewusst auf status <> 'draft' begrenzt: solange der Monat zusammengestellt
-- wird, bleibt alles editierbar. Beim Festschreiben werden die stundengestuetzten
-- Positionen ohnehin neu aus lessons aufgebaut, deshalb kann kein veralteter
-- Snapshot auf einer finalen Rechnung landen.
CREATE OR REPLACE FUNCTION lessons_guard_billed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE ii.lesson_id = COALESCE(OLD.id, NEW.id) AND i.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'Diese Stunde gehört zu einer festgeschriebenen Rechnung und ist unveränderlich.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint

CREATE TRIGGER lessons_guard BEFORE UPDATE OR DELETE ON "lessons"
  FOR EACH ROW EXECUTE FUNCTION lessons_guard_billed();
--> statement-breakpoint

-- Festgeschriebene Rechnungen sind unveraenderlich. Aenderbar bleiben nur die
-- Felder, die den Lebenszyklus abbilden (bezahlt, storniert).
CREATE OR REPLACE FUNCTION invoices_guard_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Festgeschriebene Rechnungen dürfen nicht gelöscht werden. Bitte stornieren.'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status <> 'draft' THEN
    IF NEW.number IS DISTINCT FROM OLD.number
       OR NEW.net_cents IS DISTINCT FROM OLD.net_cents
       OR NEW.tax_cents IS DISTINCT FROM OLD.tax_cents
       OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
       OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
       OR NEW.recipient_address IS DISTINCT FROM OLD.recipient_address
       OR NEW.issuer_name IS DISTINCT FROM OLD.issuer_name
       OR NEW.issuer_address IS DISTINCT FROM OLD.issuer_address
       OR NEW.tax_note IS DISTINCT FROM OLD.tax_note THEN
      RAISE EXCEPTION 'Festgeschriebene Rechnungen sind unveränderlich. Bitte stornieren und neu erstellen.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

CREATE TRIGGER invoices_guard BEFORE UPDATE OR DELETE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION invoices_guard_final();
--> statement-breakpoint

-- Positionen festgeschriebener Rechnungen sind ebenfalls gesperrt.
CREATE OR REPLACE FUNCTION invoice_items_guard_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inv_status text;
BEGIN
  SELECT status INTO inv_status FROM invoices
    WHERE id = COALESCE(OLD.invoice_id, NEW.invoice_id);
  -- Beim Loeschen der ganzen Rechnung (CASCADE) ist die Zeile schon weg: dann durchlassen.
  IF inv_status IS NOT NULL AND inv_status <> 'draft' THEN
    RAISE EXCEPTION 'Positionen festgeschriebener Rechnungen sind unveränderlich.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint

CREATE TRIGGER invoice_items_guard BEFORE INSERT OR UPDATE OR DELETE ON "invoice_items"
  FOR EACH ROW EXECUTE FUNCTION invoice_items_guard_final();
--> statement-breakpoint

-- Die eine Einstellungszeile anlegen
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
