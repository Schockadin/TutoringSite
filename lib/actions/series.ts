"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { MAX_SERIES_DAYS } from "@/lib/calendar";
import { db, lessonSeries, lessons } from "@/lib/db";

/**
 * Terminserien, z. B. "jeden Dienstag 17:00".
 *
 * Die Einzeltermine werden als echte lessons-Zeilen erzeugt, nicht aus der
 * Regel heraus errechnet. Eine Stunde wird abgerechnet, haengt an einer
 * Rechnungsposition und wird nach dem Festschreiben von Triggern gesperrt -
 * ein nur virtuell existierendes Vorkommen koennte davon nichts.
 */

/**
 * Erzeugt die Einzeltermine einer Serie.
 *
 * Sommerzeitfest, weil jedes Vorkommen einzeln als lokale Wanduhrzeit
 * interpretiert und nach Europe/Berlin umgerechnet wird. Wuerde man stattdessen
 * 7*24 Stunden auf den ersten Zeitpunkt addieren, laege die Stunde nach der
 * Zeitumstellung plötzlich um 16:00 oder 18:00.
 *
 * `ab` begrenzt auf Termine ab diesem Datum - fuer das nachtraegliche
 * Auffuellen einer verlaengerten Serie.
 */
async function materialize(
  tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  seriesId: number,
  from?: string,
) {
  await tx.execute(sql`
    insert into lessons (
      series_id, student_id, starts_at, duration_minutes, status,
      subject, location, tariff_id, price_cents, billable
    )
    select
      s.id,
      s.student_id,
      (d::text || ' ' || s.time_local)::timestamp at time zone 'Europe/Berlin',
      s.duration_minutes,
      'planned',
      s.subject,
      s.location,
      s.tariff_id,
      s.price_cents,
      s.billable
    from lesson_series s
    cross join lateral generate_series(
      s.start_date, s.until_date, (s.interval_weeks || ' weeks')::interval
    ) as g(ts)
    cross join lateral (select g.ts::date) as dd(d)
    where s.id = ${seriesId}
      ${from ? sql`and d >= ${from}::date` : sql``}
      -- Termine, die an diesem Tag zu dieser Uhrzeit schon existieren, nicht
      -- doppelt anlegen (relevant beim Verlaengern einer Serie).
      and not exists (
        select 1 from lessons l
        where l.series_id = s.id
          and l.starts_at = (d::text || ' ' || s.time_local)::timestamp at time zone 'Europe/Berlin'
      )
  `);
}

export type SeriesInput = {
  studentId: number;
  startDate: string;
  untilDate: string;
  timeLocal: string;
  intervalWeeks: number;
  durationMinutes: number;
  subject: string | null;
  location: string | null;
  tariffId: number | null;
  priceCents: number | null;
  billable: boolean;
};

/** Legt die Serie an und erzeugt alle Termine. Gibt die Zahl der Termine zurück. */
export async function createSeries(input: SeriesInput): Promise<{ seriesId: number; count: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(lessonSeries).values(input).returning({ id: lessonSeries.id });
    await materialize(tx, row!.id);
    const counted = (await tx.execute<{ count: number }>(
      sql`select count(*)::int as count from lessons where series_id = ${row!.id}`,
    )) as unknown as { count: number }[];
    return { seriesId: row!.id, count: counted[0]!.count };
  });
}

export async function getSeries(id: number) {
  const [row] = await db.select().from(lessonSeries).where(eq(lessonSeries.id, id)).limit(1);
  return row ?? null;
}

/** Übersicht: wie viele Termine der Serie sind noch offen, wie viele abgerechnet. */
export async function getSeriesSummary(id: number) {
  const [row] = (await db.execute<{
    total: number;
    upcoming: number;
    billed: number;
    nextDate: string | null;
    lastDate: string | null;
  }>(sql`
    select
      count(*)::int as "total",
      count(*) filter (
        where l.status = 'planned'
          and l.starts_at >= now()
          and not exists (select 1 from invoice_items ii where ii.lesson_id = l.id)
      )::int as "upcoming",
      count(*) filter (
        where exists (select 1 from invoice_items ii where ii.lesson_id = l.id)
      )::int as "billed",
      to_char(min(l.starts_at) filter (where l.starts_at >= now()) at time zone 'Europe/Berlin','YYYY-MM-DD') as "nextDate",
      to_char(max(l.starts_at) at time zone 'Europe/Berlin','YYYY-MM-DD') as "lastDate"
    from lessons l
    where l.series_id = ${id}
  `)) as unknown as {
    total: number; upcoming: number; billed: number; nextDate: string | null; lastDate: string | null;
  }[];
  return row!;
}

/**
 * Beendet eine Serie: alle noch offenen, unabgerechneten Termine ab heute
 * werden entfernt, die Serie wird als beendet markiert.
 *
 * Vergangene, gehaltene und abgerechnete Stunden bleiben unangetastet - sie
 * sind Geschäftsvorfälle und keine Planung mehr.
 */
export async function endSeries(seriesId: number): Promise<{ removed: number; kept: number }> {
  await requireSession();

  const result = await db.transaction(async (tx) => {
    const [counts] = (await tx.execute<{ removed: number }>(sql`
      with entfernt as (
        delete from lessons l
        where l.series_id = ${seriesId}
          and l.status = 'planned'
          and l.starts_at >= now()
          and not exists (select 1 from invoice_items ii where ii.lesson_id = l.id)
        returning 1
      )
      select count(*)::int as removed from entfernt
    `)) as unknown as { removed: number }[];

    const [kept] = (await tx.execute<{ kept: number }>(
      sql`select count(*)::int as kept from lessons where series_id = ${seriesId}`,
    )) as unknown as { kept: number }[];

    await tx
      .update(lessonSeries)
      .set({ endedAt: new Date().toISOString() })
      .where(eq(lessonSeries.id, seriesId));

    return { removed: counts!.removed, kept: kept!.kept };
  });

  revalidatePath("/app/kalender");
  revalidatePath("/app/stunden");
  return result;
}

/**
 * Verlängert eine laufende Serie bis zu einem neuen Enddatum und legt die
 * fehlenden Termine an.
 */
export async function extendSeries(
  seriesId: number,
  untilDate: string,
): Promise<{ error?: string; added?: number }> {
  await requireSession();

  const series = await getSeries(seriesId);
  if (!series) return { error: "Diese Serie gibt es nicht." };
  if (untilDate <= series.untilDate) {
    return { error: "Das neue Enddatum muss nach dem bisherigen liegen." };
  }

  const days = Math.round(
    (Date.parse(`${untilDate}T00:00:00Z`) - Date.parse(`${series.startDate}T00:00:00Z`)) / 86_400_000,
  );
  if (days > MAX_SERIES_DAYS) {
    return { error: "Eine Serie kann höchstens zwei Jahre umfassen." };
  }

  const added = await db.transaction(async (tx) => {
    await tx.update(lessonSeries).set({ untilDate, endedAt: null }).where(eq(lessonSeries.id, seriesId));
    const [before] = (await tx.execute<{ c: number }>(
      sql`select count(*)::int as c from lessons where series_id = ${seriesId}`,
    )) as unknown as { c: number }[];
    await materialize(tx, seriesId);
    const [after] = (await tx.execute<{ c: number }>(
      sql`select count(*)::int as c from lessons where series_id = ${seriesId}`,
    )) as unknown as { c: number }[];
    return after!.c - before!.c;
  });

  revalidatePath("/app/kalender");
  revalidatePath("/app/stunden");
  return { added };
}

/** Alle Serien einer Schüler:in, für die Detailansicht. */
export async function listSeriesForStudent(studentId: number) {
  return db
    .select()
    .from(lessonSeries)
    .where(and(eq(lessonSeries.studentId, studentId), isNull(lessonSeries.endedAt)))
    .orderBy(asc(lessonSeries.startDate));
}
