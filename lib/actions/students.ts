"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, invoices, lessons, students } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { OPEN_FOR_BILLING } from "@/lib/queries";
import { validateTemplate } from "@/lib/invoice-number";
import * as v from "@/lib/validate";

export type StudentFormState = { errors?: v.FieldErrors; message?: string };

function parse(formData: FormData) {
  const errors: v.FieldErrors = {};

  const values = {
    firstName: v.required(errors, "firstName", formData.get("firstName"), "einen Vornamen"),
    lastName: v.required(errors, "lastName", formData.get("lastName"), "einen Nachnamen"),
    grade: v.text(formData.get("grade"), { max: 50 }),
    school: v.text(formData.get("school"), { max: 120 }),
    subjects: v.subjects(formData.get("subjects")),
    studentEmail: v.email(errors, "studentEmail", formData.get("studentEmail")),
    studentPhone: v.text(formData.get("studentPhone"), { max: 50 }),

    billingName: v.text(formData.get("billingName"), { max: 120 }),
    billingEmail: v.email(errors, "billingEmail", formData.get("billingEmail")),
    billingPhone: v.text(formData.get("billingPhone"), { max: 50 }),
    billingStreet: v.text(formData.get("billingStreet"), { max: 120 }),
    billingPostalCode: v.text(formData.get("billingPostalCode"), { max: 10 }),
    billingCity: v.text(formData.get("billingCity"), { max: 80 }),
    billingCountry: v.text(formData.get("billingCountry"), { max: 2 }) ?? "DE",

    defaultTariffId: v.integer(errors, "defaultTariffId", formData.get("defaultTariffId"), "einen Tarif", {
      min: 1,
      max: 2_000_000_000,
      allowEmpty: true,
    }),
    hourlyRateCents: v.euroToCents(errors, "hourlyRateCents", formData.get("hourlyRateCents"), "den Stundensatz"),
    customerNumber: v.integer(errors, "customerNumber", formData.get("customerNumber"), "eine Kundennummer", {
      min: 0,
      max: 99,
      allowEmpty: true,
    }),
    invoiceNumberTemplate: v.text(formData.get("invoiceNumberTemplate"), { max: 100 }),

    notes: v.text(formData.get("notes"), { max: 4000 }),
  };

  // Leer heisst "Vorlage aus den Einstellungen verwenden" - nur ein
  // ausgefuelltes Feld wird geprueft.
  if (values.invoiceNumberTemplate) {
    const fehler = validateTemplate(values.invoiceNumberTemplate);
    if (fehler) errors.invoiceNumberTemplate = fehler;
  }

  return { errors, values };
}

export async function createStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  await requireSession();
  const { errors, values } = parse(formData);
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe die markierten Felder." };
  }

  // Ohne Angabe die naechste freie Kundennummer vergeben. Ab 100 bleibt sie
  // leer und muss von Hand gesetzt werden - zweistellig ist zweistellig.
  if (values.customerNumber === null) {
    const [frei] = await db.execute<{ next: number | null }>(
      sql`select min(n)::int as next from generate_series(1, 99) n
          where n not in (select customer_number from students where customer_number is not null)`,
    );
    values.customerNumber = (frei as unknown as { next: number | null }).next ?? null;
  }

  const [row] = await db.insert(students).values(values).returning({ id: students.id });
  revalidatePath("/app/schueler");
  redirect(`/app/schueler/${row!.id}`);
}

export async function updateStudent(
  id: number,
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  await requireSession();
  const { errors, values } = parse(formData);
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe die markierten Felder." };
  }

  await db.update(students).set(values).where(eq(students.id, id));
  revalidatePath("/app/schueler");
  revalidatePath(`/app/schueler/${id}`);
  return { message: "Gespeichert." };
}

export async function archiveStudent(id: number, archive: boolean) {
  await requireSession();
  await db
    .update(students)
    .set({ archivedAt: archive ? new Date().toISOString() : null })
    .where(eq(students.id, id));
  revalidatePath("/app/schueler");
  revalidatePath(`/app/schueler/${id}`);
}

/**
 * Endgueltiges Loeschen ist nur erlaubt, solange keine Stunden und keine
 * Rechnungen existieren. Sobald abgerechnet wurde, greift die steuerliche
 * Aufbewahrungspflicht - Art. 17 Abs. 3 lit. b DSGVO sticht dann das
 * Loeschrecht. Der Archiv-Weg ist deshalb der Normalfall.
 */
export async function deleteStudent(id: number): Promise<{ error?: string }> {
  await requireSession();

  const [counts] = await db
    .select({
      lessonCount: sql<number>`(select count(*)::int from ${lessons} where ${lessons.studentId} = ${id})`,
      invoiceCount: sql<number>`(select count(*)::int from ${invoices} where ${invoices.studentId} = ${id})`,
    })
    .from(students)
    .where(eq(students.id, id));

  if (!counts) return { error: "Diese Schüler:in gibt es nicht." };

  if (counts.lessonCount > 0 || counts.invoiceCount > 0) {
    return {
      error:
        "Löschen nicht möglich: Es liegen bereits Stunden oder Rechnungen vor. " +
        "Diese unterliegen der steuerlichen Aufbewahrungspflicht. Bitte archivieren statt löschen.",
    };
  }

  await db.delete(students).where(eq(students.id, id));
  revalidatePath("/app/schueler");
  redirect("/app/schueler");
}

export async function listStudents(includeArchived = false) {
  return db
    .select()
    .from(students)
    .where(includeArchived ? undefined : isNull(students.archivedAt))
    .orderBy(asc(students.lastName), asc(students.firstName));
}

export async function getStudent(id: number) {
  const [row] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return row ?? null;
}

export async function listActiveTariffs() {
  const { tariffs } = await import("@/lib/db");
  return db
    .select()
    .from(tariffs)
    .where(eq(tariffs.active, true))
    .orderBy(asc(tariffs.sortOrder));
}

export async function getStudentSummary(id: number) {
  const [row] = await db.execute<{
    unbilledCount: number;
    unbilledCents: number;
    openInvoiceCents: number;
    lessonCount: number;
  }>(sql`
    select
      (select count(*)::int from lessons l
        where l.student_id = ${id} and ${OPEN_FOR_BILLING}) as "unbilledCount",
      (select coalesce(sum(l.price_cents),0)::int from lessons l
        where l.student_id = ${id} and ${OPEN_FOR_BILLING}) as "unbilledCents",
      (select coalesce(sum(total_cents),0)::int from invoices
        where student_id = ${id} and status = 'open') as "openInvoiceCents",
      (select count(*)::int from lessons where student_id = ${id}) as "lessonCount"
  `);
  return row!;
}
