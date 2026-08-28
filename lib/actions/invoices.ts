"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db, invoiceItems, invoices, settings, students } from "@/lib/db";
import { billingName } from "@/lib/format";
import { OPEN_FOR_BILLING } from "@/lib/queries";
import * as v from "@/lib/validate";

export type InvoiceFormState = { errors?: v.FieldErrors; message?: string; missing?: string[] };

/** Pflichtangaben nach § 14 Abs. 4 UStG, die aus den Einstellungen kommen. */
const REQUIRED_SETTINGS: { field: keyof typeof settings.$inferSelect; label: string }[] = [
  { field: "issuerName", label: "Name des Rechnungsstellers" },
  { field: "issuerStreet", label: "Straße" },
  { field: "issuerPostalCode", label: "PLZ" },
  { field: "issuerCity", label: "Ort" },
];

async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row!;
}

/**
 * Legt einen Entwurf an und uebernimmt alle offenen, abrechenbaren Stunden des
 * Zeitraums als Positionen. Jede Stunde wird als eigene Zeile mit ihrem Datum
 * gefuehrt: das ist eindeutig, macht die Rechnung selbsterklaerend und erfuellt
 * § 14 Abs. 4 Nr. 6 UStG ohne Auslegungsspielraum.
 */
export async function createDraft(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireSession();
  const errors: v.FieldErrors = {};
  const studentId = v.integer(errors, "studentId", formData.get("studentId"), "eine Schüler:in", {
    min: 1,
    max: 2_000_000_000,
  });
  const periodStart = v.dateField(errors, "periodStart", formData.get("periodStart"), "den Beginn des Leistungszeitraums");
  const periodEnd = v.dateField(errors, "periodEnd", formData.get("periodEnd"), "das Ende des Leistungszeitraums");

  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe die markierten Felder." };
  }
  if (periodEnd < periodStart) {
    return { errors: { periodEnd: "Das Ende darf nicht vor dem Beginn liegen." } };
  }

  // Vor der Transaktion lesen: innerhalb waere es ein Deadlock (siehe recalcTotals).
  const taxRateBp = (await getSettings()).taxRateBp;

  const invoiceId = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        studentId: studentId!,
        status: "draft",
        servicePeriodStart: periodStart,
        servicePeriodEnd: periodEnd,
      })
      .returning({ id: invoices.id });

    await tx.execute(sql`
      insert into invoice_items
        (invoice_id, lesson_id, position, description, service_date, quantity, unit, unit_price_cents, amount_cents)
      select
        ${invoice!.id},
        l.id,
        row_number() over (order by l.starts_at),
        'Nachhilfeunterricht'
          || coalesce(' ' || l.subject, '')
          || ' (' || l.duration_minutes || ' Minuten)',
        (l.starts_at at time zone 'Europe/Berlin')::date,
        1,
        'Einheit',
        coalesce(l.price_cents, 0),
        coalesce(l.price_cents, 0)
      from lessons l
      where l.student_id = ${studentId}
        and ${OPEN_FOR_BILLING}
        and l.starts_at >= (${periodStart}::date::timestamp at time zone 'Europe/Berlin')
        and l.starts_at <  ((${periodEnd}::date + interval '1 day')::timestamp at time zone 'Europe/Berlin')
    `);

    // Guthaben, die im Zeitraum gekauft, aber noch nicht bezahlt und noch auf
    // keiner Rechnung sind. Berechnet wird das Paket - die daraus verrechneten
    // Stunden nicht mehr, die sind ja damit bezahlt.
    await tx.execute(sql`
      insert into invoice_items
        (invoice_id, package_id, position, description, service_date, quantity, unit,
         unit_price_cents, amount_cents)
      select
        ${invoice!.id},
        p.id,
        (select coalesce(max(position),0) from invoice_items where invoice_id = ${invoice!.id})
          + row_number() over (order by p.purchased_on, p.id),
        p.label
          || case when p.kind = 'units'
                  then ' (' || p.total_units || ' Einheiten à ' || p.unit_duration_minutes || ' Minuten)'
                  else '' end,
        p.purchased_on,
        1,
        'Paket',
        p.price_cents,
        p.price_cents
      from credit_packages p
      where p.student_id = ${studentId}
        and p.cancelled_at is null
        and p.paid_on is null
        and not exists (select 1 from invoice_items ii where ii.package_id = p.id)
        -- Bewusst ohne untere Grenze: ein Guthaben, das vor dem Zeitraum
        -- gekauft und noch nicht berechnet wurde, würde sonst dauerhaft
        -- durchs Raster fallen. Es landet auf der nächsten Rechnung.
        and p.purchased_on <= ${periodEnd}::date
    `);

    await recalcTotals(tx, invoice!.id, taxRateBp);
    return invoice!.id;
  });

  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${invoiceId}`);
}

/**
 * Summen aus den Positionen neu berechnen. Gerundet wird genau einmal, auf der
 * Gesamtsumme statt je Zeile - so bleibt total = netto + steuer exakt, was der
 * CHECK in der Datenbank auch erzwingt.
 *
 * Der Parameter ist bewusst nur auf "kann execute" typisiert, damit sowohl die
 * Datenbank selbst als auch eine Transaktion uebergeben werden koennen.
 */
type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * WICHTIG: taxRateBp wird uebergeben und nicht hier nachgeladen.
 *
 * Der Pool haelt genau eine Verbindung (max: 1, passend zu einer Lambda-
 * Instanz). Wer innerhalb einer Transaktion eine Abfrage ueber den Pool statt
 * ueber tx absetzt, wartet auf eine Verbindung, die die eigene Transaktion
 * gerade haelt - und blockiert damit dauerhaft den gesamten Server. Genau das
 * ist hier passiert, als getSettings() an dieser Stelle stand.
 */
async function recalcTotals(tx: Executor, invoiceId: number, taxRateBp: number) {
  await tx.execute(sql`
    update invoices set
      net_cents   = coalesce((select sum(amount_cents) from invoice_items where invoice_id = ${invoiceId}), 0),
      tax_cents   = round(
        coalesce((select sum(amount_cents) from invoice_items where invoice_id = ${invoiceId}), 0)
        * ${taxRateBp}::numeric / 10000),
      total_cents = coalesce((select sum(amount_cents) from invoice_items where invoice_id = ${invoiceId}), 0)
        + round(
          coalesce((select sum(amount_cents) from invoice_items where invoice_id = ${invoiceId}), 0)
          * ${taxRateBp}::numeric / 10000)
    where id = ${invoiceId}
  `);
}

export async function addItem(
  invoiceId: number,
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireSession();
  const errors: v.FieldErrors = {};
  const description = v.required(errors, "description", formData.get("description"), "eine Bezeichnung", 200);
  const quantity = v.integer(errors, "quantity", formData.get("quantity"), "die Menge", { min: 1, max: 9999 }) ?? 1;
  // Negative Betraege sind zulaessig: Rabattzeilen sind nach
  // § 14 Abs. 4 Nr. 7 UStG auszuweisen.
  const rawPrice = String(formData.get("unitPrice") ?? "").trim().replace(",", ".");
  const unitPrice = Number(rawPrice);
  if (!rawPrice || !Number.isFinite(unitPrice)) {
    errors.unitPrice = "Bitte einen Betrag angeben (negativ für Rabatte).";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const unitPriceCents = Math.round(unitPrice * 100);
  const taxRateBp = (await getSettings()).taxRateBp;

  try {
    await db.transaction(async (tx) => {
      const [max] = await tx.execute<{ next: number }>(
        sql`select coalesce(max(position),0)+1 as next from invoice_items where invoice_id = ${invoiceId}`,
      );
      await tx.insert(invoiceItems).values({
        invoiceId,
        position: (max as unknown as { next: number }).next,
        description,
        quantity,
        unit: v.text(formData.get("unit"), { max: 30 }) ?? "Einheit",
        unitPriceCents,
        amountCents: quantity * unitPriceCents,
        serviceDate: v.text(formData.get("serviceDate")),
      });
      await recalcTotals(tx, invoiceId, taxRateBp);
    });
  } catch (err) {
    return { message: dbMessage(err, "Die Position konnte nicht hinzugefügt werden.") };
  }

  revalidatePath(`/app/rechnungen/${invoiceId}`);
  return { message: "Position hinzugefügt." };
}

export async function removeItem(invoiceId: number, itemId: number): Promise<{ error?: string }> {
  await requireSession();
  const taxRateBp = (await getSettings()).taxRateBp;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(invoiceItems).where(eq(invoiceItems.id, itemId));
      await recalcTotals(tx, invoiceId, taxRateBp);
    });
  } catch (err) {
    return { error: dbMessage(err, "Die Position konnte nicht entfernt werden.") };
  }
  revalidatePath(`/app/rechnungen/${invoiceId}`);
  return {};
}

/**
 * Festschreiben.
 *
 * Drei Dinge passieren in einer Transaktion:
 *  1. Alle stundengestuetzten Positionen werden aus lessons neu aufgebaut.
 *     Damit kann kein veralteter Snapshot auf einer finalen Rechnung landen.
 *  2. Absender, Empfaenger und Steuerangaben werden auf die Rechnung kopiert.
 *     Wuerde der Druck live aus den Einstellungen lesen, wuerde ein
 *     Adresswechsel die Historie umschreiben.
 *  3. Die Nummer wird vergeben.
 */
export async function finalizeInvoice(invoiceId: number): Promise<InvoiceFormState> {
  await requireSession();

  const s = await getSettings();

  const missing = REQUIRED_SETTINGS.filter((r) => !String(s[r.field] ?? "").trim()).map((r) => r.label);
  // § 14 Abs. 4 Nr. 2 UStG: Steuernummer ODER USt-IdNr., mindestens eines.
  if (!s.taxNumber.trim() && !s.vatId.trim()) {
    missing.push("Steuernummer oder USt-IdNr.");
  }
  if (missing.length > 0) {
    return {
      missing,
      message:
        "Die Rechnung kann noch nicht festgeschrieben werden: In den Einstellungen fehlen Pflichtangaben nach § 14 UStG.",
    };
  }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return { message: "Diese Rechnung gibt es nicht." };
  if (invoice.status !== "draft") return { message: "Diese Rechnung ist bereits festgeschrieben." };

  const [student] = await db.select().from(students).where(eq(students.id, invoice.studentId)).limit(1);
  if (!student) return { message: "Die zugehörige Schüler:in fehlt." };

  const recipientAddress = [
    student.billingStreet,
    [student.billingPostalCode, student.billingCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  if (!recipientAddress.trim()) {
    return {
      missing: ["Anschrift des Rechnungsempfängers"],
      message:
        "Die Rechnung kann noch nicht festgeschrieben werden: Für den Rechnungsempfänger fehlt die Anschrift (§ 14 Abs. 4 Nr. 1 UStG).",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Positionen aus den Stunden neu aufbauen
      await tx.execute(sql`
        update invoice_items ii set
          description = 'Nachhilfeunterricht'
            || coalesce(' ' || l.subject, '')
            || ' (' || l.duration_minutes || ' Minuten)',
          service_date = (l.starts_at at time zone 'Europe/Berlin')::date,
          unit_price_cents = coalesce(l.price_cents, 0),
          amount_cents = ii.quantity * coalesce(l.price_cents, 0)
        from lessons l
        where ii.lesson_id = l.id and ii.invoice_id = ${invoiceId}
      `);
      await recalcTotals(tx, invoiceId, s.taxRateBp);

      // 2. Nummer vergeben. Kein SEQUENCE: nextval() ist nicht-transaktional,
      //    ein Rollback wuerde die Nummer dauerhaft verbrennen und genau die
      //    Luecken erzeugen, die § 14 Abs. 4 Nr. 4 UStG vermeiden will.
      //    ON CONFLICT DO UPDATE haelt die Zeilensperre bis zum Commit.
      const year = Number(
        (
          (await tx.execute<{ y: string }>(
            sql`select to_char(now() at time zone 'Europe/Berlin','YYYY') as y`,
          )) as unknown as { y: string }[]
        )[0]!.y,
      );

      const seqRows = (await tx.execute<{ last_seq: number }>(sql`
        insert into invoice_counters (year, last_seq) values (${year}, 1)
        on conflict (year) do update set last_seq = invoice_counters.last_seq + 1
        returning last_seq
      `)) as unknown as { last_seq: number }[];
      const seq = seqRows[0]!.last_seq;
      const number = `${s.invoiceNumberPrefix}-${year}-${String(seq).padStart(4, "0")}`;

      // 3. Alles Druckrelevante festschreiben
      await tx.execute(sql`
        update invoices set
          status = 'open',
          number = ${number},
          number_year = ${year},
          number_seq = ${seq},
          issue_date = (now() at time zone 'Europe/Berlin')::date,
          -- ::int ist noetig: ohne Typangabe ist "date + unknown" mehrdeutig
          -- (Tage oder Intervall) und Postgres bricht mit 42725 ab.
          due_date = (now() at time zone 'Europe/Berlin')::date + ${s.paymentTermsDays}::int,
          issuer_name = ${s.issuerName},
          issuer_address = ${`${s.issuerStreet}\n${s.issuerPostalCode} ${s.issuerCity}`},
          issuer_email = ${s.issuerEmail},
          issuer_phone = ${s.issuerPhone},
          issuer_tax_number = ${s.taxNumber},
          issuer_vat_id = ${s.vatId},
          issuer_account_holder = ${s.bankAccountHolder},
          issuer_iban = ${s.iban},
          issuer_bic = ${s.bic},
          recipient_name = ${billingName(student)},
          recipient_address = ${recipientAddress},
          tax_mode = ${s.taxMode},
          tax_rate_bp = ${s.taxRateBp},
          tax_note = ${s.taxNote},
          intro_text = coalesce(intro_text, ${s.invoiceIntroText}),
          footer_note = coalesce(footer_note, ${s.invoiceFooterNote})
        where id = ${invoiceId}
      `);
    });
  } catch (err) {
    return { message: dbMessage(err, "Die Rechnung konnte nicht festgeschrieben werden.") };
  }

  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/rechnungen/${invoiceId}`);
  revalidatePath("/app");
  return { message: "Rechnung festgeschrieben." };
}

export async function markPaid(invoiceId: number, paidOn: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    await db.update(invoices).set({ status: "paid", paidOn }).where(eq(invoices.id, invoiceId));
  } catch (err) {
    return { error: dbMessage(err, "Der Status konnte nicht geändert werden.") };
  }
  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/rechnungen/${invoiceId}`);
  return {};
}

/**
 * Storno. Eine festgeschriebene Rechnung wird nie geloescht oder geaendert,
 * sondern durch eine Stornorechnung mit eigener Nummer und negierten
 * Positionen aufgehoben. Die Originalnummer bleibt erhalten.
 */
export async function cancelInvoice(invoiceId: number): Promise<{ error?: string; newId?: number }> {
  await requireSession();
  const s = await getSettings();

  const [original] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!original) return { error: "Diese Rechnung gibt es nicht." };
  if (original.status === "draft") return { error: "Entwürfe werden gelöscht, nicht storniert." };
  if (original.status === "cancelled") return { error: "Diese Rechnung ist bereits storniert." };

  try {
    const newId = await db.transaction(async (tx) => {
      const year = Number(
        (
          (await tx.execute<{ y: string }>(
            sql`select to_char(now() at time zone 'Europe/Berlin','YYYY') as y`,
          )) as unknown as { y: string }[]
        )[0]!.y,
      );
      const seqRows = (await tx.execute<{ last_seq: number }>(sql`
        insert into invoice_counters (year, last_seq) values (${year}, 1)
        on conflict (year) do update set last_seq = invoice_counters.last_seq + 1
        returning last_seq
      `)) as unknown as { last_seq: number }[];
      const seq = seqRows[0]!.last_seq;
      const number = `${s.invoiceNumberPrefix}-${year}-${String(seq).padStart(4, "0")}`;

      // Zuerst als Entwurf ohne Nummer anlegen: der Trigger laesst Positionen
      // nur auf Entwuerfen zu, und der CHECK verlangt, dass eine Nummer und ein
      // Status ungleich 'draft' immer zusammen auftreten.
      const [storno] = (await tx.execute<{ id: number }>(sql`
        insert into invoices (
          student_id, status, service_period_start, service_period_end,
          issuer_name, issuer_address, issuer_email, issuer_phone, issuer_tax_number,
          issuer_vat_id, issuer_account_holder, issuer_iban, issuer_bic,
          recipient_name, recipient_address, tax_mode, tax_rate_bp, tax_note,
          net_cents, tax_cents, total_cents, intro_text, cancels_invoice_id
        )
        select
          student_id, 'draft', service_period_start, service_period_end,
          issuer_name, issuer_address, issuer_email, issuer_phone, issuer_tax_number,
          issuer_vat_id, issuer_account_holder, issuer_iban, issuer_bic,
          recipient_name, recipient_address, tax_mode, tax_rate_bp, tax_note,
          0, 0, 0,
          ${`Stornorechnung zu Rechnung ${original.number} vom ${original.issueDate}.`},
          ${invoiceId}
        from invoices where id = ${invoiceId}
        returning id
      `)) as unknown as { id: number }[];

      // Positionen negiert uebernehmen
      await tx.execute(sql`
        insert into invoice_items
          (invoice_id, position, description, service_date, quantity, unit, unit_price_cents, amount_cents)
        select ${storno!.id}, position, 'Storno: ' || description, service_date,
               quantity, unit, -unit_price_cents, -amount_cents
        from invoice_items where invoice_id = ${invoiceId}
      `);

      // Jetzt festschreiben: Nummer vergeben und Betraege spiegeln. Die Summen
      // sind die negierten Summen des Originals, damit Positionen und Endsumme
      // zusammenpassen.
      await tx.execute(sql`
        update invoices set
          status = 'open',
          number = ${number},
          number_year = ${year},
          number_seq = ${seq},
          issue_date = (now() at time zone 'Europe/Berlin')::date,
          due_date = (now() at time zone 'Europe/Berlin')::date,
          net_cents = ${-original.netCents},
          tax_cents = ${-original.taxCents},
          total_cents = ${-original.totalCents}
        where id = ${storno!.id}
      `);

      await tx
        .update(invoices)
        .set({ status: "cancelled", cancelledAt: new Date().toISOString() })
        .where(eq(invoices.id, invoiceId));

      return storno!.id;
    });

    revalidatePath("/app/rechnungen");
    return { newId };
  } catch (err) {
    return { error: dbMessage(err, "Die Rechnung konnte nicht storniert werden.") };
  }
}

export async function deleteDraft(invoiceId: number): Promise<{ error?: string }> {
  await requireSession();
  try {
    await db.delete(invoices).where(eq(invoices.id, invoiceId));
  } catch (err) {
    return { error: dbMessage(err, "Der Entwurf konnte nicht gelöscht werden.") };
  }
  revalidatePath("/app/rechnungen");
  redirect("/app/rechnungen");
}

export async function listInvoices() {
  return db.execute<{
    id: number;
    number: string | null;
    status: string;
    issueDate: string | null;
    totalCents: number;
    studentId: number;
    studentName: string;
  }>(sql`
    select i.id, i.number, i.status, i.issue_date as "issueDate", i.total_cents as "totalCents",
           i.student_id as "studentId", s.first_name || ' ' || s.last_name as "studentName"
    from invoices i join students s on s.id = i.student_id
    order by i.issue_date desc nulls first, i.id desc
  `);
}

export async function getInvoice(id: number) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return null;
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.position));
  const [student] = await db.select().from(students).where(eq(students.id, invoice.studentId)).limit(1);
  return { invoice, items, student: student! };
}

function dbMessage(err: unknown, fallback: string): string {
  // Die Ursache gehoert ins Serverlog: die Meldung fuer die Oberflaeche ist
  // bewusst knapp, aber im Betrieb muss nachvollziehbar bleiben, was schiefging.
  console.error("[Datenbankfehler]", err);
  const message = err instanceof Error ? err.message : "";
  if (message.includes("unveränderlich") || message.includes("festgeschrieben")) {
    return message.split("\n")[0]!;
  }
  return fallback;
}
