"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db, invoiceItems, invoices, lessons, students, tariffs } from "@/lib/db";
import { berlinTimestamp } from "@/lib/queries";
import { MAX_SERIES_DAYS } from "@/lib/calendar";
import { redeemLesson } from "./credits";
import { createSeries } from "./series";
import * as v from "@/lib/validate";

export type LessonFormState = { errors?: v.FieldErrors; message?: string; warning?: string };

/**
 * Preisauflösung.
 *
 * Ausdruecklich NICHT "Dauer x Stundensatz": laut Preisliste kostet eine
 * 60-Minuten-Stunde 35 EUR, eine 90-Minuten-Stunde aber 45 EUR und nicht 52,50.
 * Abgerechnet wird die Stunde aus der Tariftabelle.
 *
 * Reihenfolge:
 *   1. ausdruecklich angegebener Preis (manuelle Korrektur gewinnt immer)
 *   2. ausgewaehlter Tarif
 *   3. Standardtarif der Schueler:in, falls die Dauer passt
 *   4. irgendein aktiver Tarif mit passender Dauer
 *   5. Stundensatz der Schueler:in, anteilig gerechnet
 *   6. sonst null - erlaubt fuer einen geplanten Termin, aber der CHECK in der
 *      Datenbank verhindert den Uebergang auf "gehalten"
 */
async function resolvePrice(opts: {
  explicitCents: number | null;
  tariffId: number | null;
  studentId: number;
  durationMinutes: number;
}): Promise<{ priceCents: number | null; tariffId: number | null }> {
  if (opts.explicitCents !== null) {
    return { priceCents: opts.explicitCents, tariffId: opts.tariffId };
  }

  if (opts.tariffId !== null) {
    const [t] = await db.select().from(tariffs).where(eq(tariffs.id, opts.tariffId)).limit(1);
    if (t) return { priceCents: t.priceCents, tariffId: t.id };
  }

  const [student] = await db.select().from(students).where(eq(students.id, opts.studentId)).limit(1);

  if (student?.defaultTariffId) {
    const [t] = await db
      .select()
      .from(tariffs)
      .where(eq(tariffs.id, student.defaultTariffId))
      .limit(1);
    if (t && t.durationMinutes === opts.durationMinutes) {
      return { priceCents: t.priceCents, tariffId: t.id };
    }
  }

  const [match] = await db
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.active, true), eq(tariffs.durationMinutes, opts.durationMinutes)))
    .orderBy(tariffs.sortOrder)
    .limit(1);
  if (match) return { priceCents: match.priceCents, tariffId: match.id };

  if (student?.hourlyRateCents != null) {
    // Die einzige Division im ganzen Preispfad.
    return {
      priceCents: Math.round((opts.durationMinutes * student.hourlyRateCents) / 60),
      tariffId: null,
    };
  }

  return { priceCents: null, tariffId: null };
}

/**
 * Sucht Ueberschneidungen, blockiert sie aber NICHT.
 *
 * Eine Datenbankbedingung waere elegant, wuerde aber legitime Faelle
 * verhindern: zwei Geschwister im selben Slot, eine Gruppenstunde, zehn Minuten
 * Ueberlappung beim Wechsel. Die Entscheidung gehoert der Lehrkraft, deshalb
 * nur ein Hinweis.
 */
async function findOverlap(date: string, time: string, minutes: number, excludeId?: number) {
  const rows = await db.execute<{ studentName: string; timeLocal: string }>(sql`
    select s.first_name || ' ' || s.last_name as "studentName",
           to_char(l.starts_at at time zone 'Europe/Berlin','HH24:MI') as "timeLocal"
    from lessons l join students s on s.id = l.student_id
    where l.status in ('planned','held')
      ${excludeId ? sql`and l.id <> ${excludeId}` : sql``}
      and tstzrange(l.starts_at, l.starts_at + (l.duration_minutes || ' minutes')::interval)
          && tstzrange(${berlinTimestamp(date, time)},
                       ${berlinTimestamp(date, time)} + (${minutes} || ' minutes')::interval)
    limit 3
  `);
  return rows as unknown as { studentName: string; timeLocal: string }[];
}

function parse(formData: FormData) {
  const errors: v.FieldErrors = {};
  const studentId = v.integer(errors, "studentId", formData.get("studentId"), "eine Schüler:in", {
    min: 1,
    max: 2_000_000_000,
  });
  const date = v.dateField(errors, "date", formData.get("date"), "ein Datum");
  const time = v.timeField(errors, "time", formData.get("time"), "eine Uhrzeit");
  const durationMinutes =
    v.integer(errors, "durationMinutes", formData.get("durationMinutes"), "die Dauer in Minuten", {
      min: 1,
      max: 600,
    }) ?? 60;
  const tariffId = v.integer(errors, "tariffId", formData.get("tariffId"), "einen Tarif", {
    min: 1,
    max: 2_000_000_000,
    allowEmpty: true,
  });
  const explicitCents = v.euroToCents(errors, "priceCents", formData.get("priceCents"), "den Preis");

  return {
    errors,
    studentId,
    date,
    time,
    durationMinutes,
    tariffId,
    explicitCents,
    status: String(formData.get("status") ?? "planned"),
    billable: formData.get("billable") !== null,
    subject: v.text(formData.get("subject"), { max: 100 }),
    location: v.text(formData.get("location"), { max: 100 }),
    topic: v.text(formData.get("topic"), { max: 500 }),
    notes: v.text(formData.get("notes"), { max: 4000 }),
  };
}

export async function createLesson(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  await requireSession();
  const p = parse(formData);
  if (Object.keys(p.errors).length > 0) {
    return { errors: p.errors, message: "Bitte überprüfe die markierten Felder." };
  }

  const { priceCents, tariffId } = await resolvePrice({
    explicitCents: p.explicitCents,
    tariffId: p.tariffId,
    studentId: p.studentId!,
    durationMinutes: p.durationMinutes,
  });

  if (priceCents === null && p.billable && p.status !== "planned") {
    return {
      errors: { priceCents: "Für diese Dauer ist kein Tarif hinterlegt – bitte Preis angeben." },
      message: "Preis fehlt.",
    };
  }

  // Serientermin? Dann Serie anlegen und alle Einzeltermine erzeugen.
  const repeat = formData.get("repeat") !== null;
  if (repeat) {
    const intervalWeeks =
      v.integer(p.errors, "repeatIntervalWeeks", formData.get("repeatIntervalWeeks"), "den Abstand in Wochen", {
        min: 1,
        max: 8,
        allowEmpty: true,
        fallback: 1,
      }) ?? 1;
    const until = v.dateField(p.errors, "repeatUntil", formData.get("repeatUntil"), "ein Enddatum der Serie");

    if (Object.keys(p.errors).length > 0) {
      return { errors: p.errors, message: "Bitte überprüfe die markierten Felder." };
    }
    if (until < p.date) {
      return { errors: { repeatUntil: "Das Enddatum muss nach dem ersten Termin liegen." } };
    }
    const days = Math.round(
      (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${p.date}T00:00:00Z`)) / 86_400_000,
    );
    if (days > MAX_SERIES_DAYS) {
      return { errors: { repeatUntil: "Eine Serie kann höchstens zwei Jahre umfassen." } };
    }
    if (priceCents === null && p.billable) {
      return {
        errors: { priceCents: "Für diese Dauer ist kein Tarif hinterlegt – bitte Preis angeben." },
        message: "Preis fehlt.",
      };
    }

    const { count } = await createSeries({
      studentId: p.studentId!,
      startDate: p.date,
      untilDate: until,
      timeLocal: p.time,
      intervalWeeks,
      durationMinutes: p.durationMinutes,
      subject: p.subject,
      location: p.location,
      tariffId,
      priceCents,
      billable: p.billable,
    });

    revalidatePath("/app/stunden");
    revalidatePath("/app/kalender");
    revalidatePath("/app");
    redirect(`/app/kalender?monat=${p.date.slice(0, 7)}&serie=${count}`);
  }

  const overlap = await findOverlap(p.date, p.time, p.durationMinutes);

  const [row] = await db
    .insert(lessons)
    .values({
      studentId: p.studentId!,
      startsAt: sql`${berlinTimestamp(p.date, p.time)}` as unknown as string,
      durationMinutes: p.durationMinutes,
      status: p.status,
      billable: p.billable,
      subject: p.subject,
      location: p.location,
      topic: p.topic,
      notes: p.notes,
      tariffId,
      priceCents,
      ...(p.status === "cancelled" ? { cancelledAt: new Date().toISOString() } : {}),
    })
    .returning({ id: lessons.id });

  revalidatePath("/app/stunden");
  revalidatePath("/app/kalender");
  revalidatePath("/app");

  if (overlap.length > 0) {
    const names = overlap.map((o) => `${o.timeLocal} ${o.studentName}`).join(", ");
    redirect(`/app/stunden/${row!.id}?warnung=${encodeURIComponent(names)}`);
  }
  redirect(`/app/stunden/${row!.id}`);
}

export async function updateLesson(
  id: number,
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  await requireSession();
  const p = parse(formData);
  if (Object.keys(p.errors).length > 0) {
    return { errors: p.errors, message: "Bitte überprüfe die markierten Felder." };
  }

  const { priceCents, tariffId } = await resolvePrice({
    explicitCents: p.explicitCents,
    tariffId: p.tariffId,
    studentId: p.studentId!,
    durationMinutes: p.durationMinutes,
  });

  try {
    await db
      .update(lessons)
      .set({
        studentId: p.studentId!,
        startsAt: sql`${berlinTimestamp(p.date, p.time)}` as unknown as string,
        durationMinutes: p.durationMinutes,
        status: p.status,
        billable: p.billable,
        subject: p.subject,
        location: p.location,
        topic: p.topic,
        notes: p.notes,
        tariffId,
        priceCents,
        cancelledAt: p.status === "cancelled" ? new Date().toISOString() : null,
      })
      .where(eq(lessons.id, id));
  } catch (err) {
    return { message: dbMessage(err, "Die Stunde konnte nicht gespeichert werden.") };
  }

  revalidatePath("/app/stunden");
  revalidatePath("/app/kalender");
  return { message: "Gespeichert." };
}

/**
 * Der Ein-Klick-Schritt Termin -> gehaltene Stunde.
 *
 * Gibt es ein passendes Guthaben, wird die Stunde gleich dagegen verrechnet.
 * Das ist der Punkt, an dem vorausbezahlte Stunden tatsaechlich wirken: die
 * Stunde faellt damit aus der offenen Abrechnung heraus, weil sie schon
 * bezahlt ist. Die Verrechnung wird zurueckgemeldet und laesst sich am Termin
 * jederzeit wieder aufheben.
 */
export async function holdLesson(id: number): Promise<{ error?: string; redeemed?: boolean }> {
  await requireSession();

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!lesson) return { error: "Diese Stunde gibt es nicht." };

  let priceCents = lesson.priceCents;
  if (priceCents === null && lesson.billable) {
    const resolved = await resolvePrice({
      explicitCents: null,
      tariffId: lesson.tariffId,
      studentId: lesson.studentId,
      durationMinutes: lesson.durationMinutes,
    });
    priceCents = resolved.priceCents;
    if (priceCents === null) {
      return {
        error:
          "Für diese Dauer ist kein Tarif hinterlegt. Bitte trage zuerst einen Preis ein, dann kann die Stunde abgerechnet werden.",
      };
    }
  }

  try {
    await db
      .update(lessons)
      .set({ status: "held", priceCents, cancelledAt: null })
      .where(eq(lessons.id, id));
  } catch (err) {
    return { error: dbMessage(err, "Die Stunde konnte nicht als gehalten markiert werden.") };
  }

  // Automatisch gegen ein Guthaben verrechnen, falls eines passt.
  const redemption = await redeemLesson(id);

  revalidatePath("/app/kalender");
  revalidatePath("/app/stunden");
  revalidatePath("/app");
  return { redeemed: redemption.packageId !== undefined };
}

export async function cancelLesson(
  id: number,
  reason: string,
  billable: boolean,
): Promise<{ error?: string }> {
  await requireSession();
  try {
    await db
      .update(lessons)
      .set({
        // Nicht erschienen bleibt oft abrechenbar, eine Absage in der Regel nicht.
        status: billable ? "no_show" : "cancelled",
        billable,
        cancellationReason: reason || null,
        cancelledAt: billable ? null : new Date().toISOString(),
      })
      .where(eq(lessons.id, id));
  } catch (err) {
    return { error: dbMessage(err, "Die Stunde konnte nicht abgesagt werden.") };
  }
  revalidatePath("/app/kalender");
  revalidatePath("/app/stunden");
  return {};
}

export async function deleteLesson(id: number): Promise<{ error?: string }> {
  await requireSession();

  const [item] = await db
    .select({ invoiceId: invoiceItems.invoiceId, status: invoices.status })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(eq(invoiceItems.lessonId, id))
    .limit(1);

  if (item) {
    return {
      error:
        item.status === "draft"
          ? "Diese Stunde steht auf einem Rechnungsentwurf. Bitte entferne dort zuerst die Position."
          : "Diese Stunde ist bereits abgerechnet und kann nicht gelöscht werden.",
    };
  }

  try {
    await db.delete(lessons).where(eq(lessons.id, id));
  } catch (err) {
    return { error: dbMessage(err, "Die Stunde konnte nicht gelöscht werden.") };
  }

  revalidatePath("/app/stunden");
  revalidatePath("/app/kalender");
  redirect("/app/stunden");
}

/**
 * Die Trigger in der Datenbank liefern bereits deutsche, fachlich richtige
 * Meldungen. Die werden durchgereicht statt sie im Code zu doppeln.
 */
function dbMessage(err: unknown, fallback: string): string {
  // Die Ursache gehoert ins Serverlog: die Meldung fuer die Oberflaeche ist
  // bewusst knapp, aber im Betrieb muss nachvollziehbar bleiben, was schiefging.
  console.error("[Datenbankfehler]", err);
  const message = err instanceof Error ? err.message : "";
  if (message.includes("festgeschriebenen Rechnung") || message.includes("unveränderlich")) {
    return message.split("\n")[0]!;
  }
  return fallback;
}
