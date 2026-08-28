import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Alle Zeitzonenumrechnungen passieren in SQL, nie in JavaScript.
 *
 * Postgres bringt die IANA-Zeitzonendatenbank mit und rechnet Sommerzeit
 * korrekt um. Sobald der Browser oder Node ein Date-Objekt anfassen wuerde,
 * haengt das Ergebnis an der Zeitzone des jeweiligen Geraets bzw. Containers –
 * genau die Fehlerklasse, die hier nicht auftreten soll.
 *
 * Gelesen wird deshalb ausschliesslich in fertig formatierten Strings.
 */
export const BERLIN = "Europe/Berlin";

/** Wandelt "YYYY-MM-DD" plus "HH:MM" (Berliner Ortszeit) in einen Zeitpunkt. */
export function berlinTimestamp(date: string, time: string) {
  return sql`(${`${date} ${time}`}::timestamp at time zone ${BERLIN})`;
}

/** Tagesbeginn in Berliner Ortszeit als absoluter Zeitpunkt. */
export function berlinDayStart(date: string) {
  return sql`(${date}::date::timestamp at time zone ${BERLIN})`;
}

/** Beginn des Tages nach einem Zeitraum – fuer Bereichsabfragen (>= von, < bis). */
export function berlinDayAfter(date: string) {
  return sql`((${date}::date + interval '1 day')::timestamp at time zone ${BERLIN})`;
}

/** Heutiges Datum in Berliner Ortszeit als "YYYY-MM-DD". */
export async function berlinToday(): Promise<string> {
  const [row] = await db.execute<{ today: string }>(
    sql`select to_char(now() at time zone ${BERLIN}, 'YYYY-MM-DD') as today`,
  );
  return row!.today;
}

/**
 * Wann eine Stunde noch abzurechnen ist - die EINZIGE Definition dieser Regel.
 *
 * Sie stand vorher an fuenf Stellen verteilt. Mit dem Guthaben kam eine sechste
 * Bedingung hinzu, und genau dann wird verteiltes Wissen gefaehrlich: haette
 * man eine Stelle vergessen, waere eine bereits vorausbezahlte Stunde ein
 * zweites Mal in Rechnung gestellt worden.
 *
 * Erwartet die lessons-Zeile unter dem Alias `l`.
 */
export const OPEN_FOR_BILLING = sql`
  l.billable
  and l.status in ('held','no_show')
  and not exists (select 1 from invoice_items ii where ii.lesson_id = l.id)
  and not exists (select 1 from credit_redemptions cr where cr.lesson_id = l.id)
`;

export type LessonRow = {
  id: number;
  studentId: number;
  studentName: string;
  dateLocal: string; // YYYY-MM-DD, Berliner Ortszeit
  timeLocal: string; // HH:MM,     Berliner Ortszeit
  durationMinutes: number;
  status: string;
  subject: string | null;
  topic: string | null;
  location: string | null;
  priceCents: number | null;
  billable: boolean;
  seriesId: number | null;
  invoiceId: number | null;
  invoiceStatus: string | null;
  /** Gesetzt, wenn die Stunde gegen ein Guthaben verrechnet wurde. */
  creditPackageId: number | null;
  creditPackageLabel: string | null;
};

/**
 * Gemeinsame Auswahl fuer alle Stundenlisten. Der Zeitraum wird als Bereich
 * abgefragt (>= von, < bis) statt ueber date_trunc, damit der Index auf
 * starts_at genutzt werden kann.
 */
export async function listLessons(opts: {
  from?: string;
  to?: string;
  studentId?: number;
  status?: string;
  unbilledOnly?: boolean;
  lessonId?: number;
  /** Ganzer Monat als "YYYY-MM". Sicherer als ein selbst gebautes Enddatum. */
  month?: string;
  limit?: number;
}): Promise<LessonRow[]> {
  const conditions = [sql`true`];
  if (opts.from) conditions.push(sql`l.starts_at >= ${berlinDayStart(opts.from)}`);
  if (opts.to) conditions.push(sql`l.starts_at < ${berlinDayAfter(opts.to)}`);
  if (opts.month) {
    // Postgres rechnet das Monatsende selbst aus. Ein zusammengesetztes
    // "YYYY-MM-31" waere in fünf von zwölf Monaten ein ungültiges Datum.
    conditions.push(
      sql`l.starts_at >= ((${opts.month} || '-01')::date::timestamp at time zone ${BERLIN})`,
    );
    conditions.push(
      sql`l.starts_at < (((${opts.month} || '-01')::date + interval '1 month')::timestamp at time zone ${BERLIN})`,
    );
  }
  if (opts.studentId) conditions.push(sql`l.student_id = ${opts.studentId}`);
  if (opts.lessonId) conditions.push(sql`l.id = ${opts.lessonId}`);
  if (opts.status) conditions.push(sql`l.status = ${opts.status}`);
  if (opts.unbilledOnly) {
    conditions.push(OPEN_FOR_BILLING);
  }

  const rows = await db.execute<LessonRow>(sql`
    select
      l.id                                                          as "id",
      l.student_id                                                  as "studentId",
      s.first_name || ' ' || s.last_name                            as "studentName",
      to_char(l.starts_at at time zone ${BERLIN}, 'YYYY-MM-DD')     as "dateLocal",
      to_char(l.starts_at at time zone ${BERLIN}, 'HH24:MI')        as "timeLocal",
      l.duration_minutes                                            as "durationMinutes",
      l.status                                                      as "status",
      l.subject                                                     as "subject",
      l.topic                                                       as "topic",
      l.location                                                    as "location",
      l.price_cents                                                 as "priceCents",
      l.billable                                                    as "billable",
      l.series_id                                                   as "seriesId",
      inv.id                                                        as "invoiceId",
      inv.status                                                    as "invoiceStatus",
      cp.id                                                         as "creditPackageId",
      cp.label                                                      as "creditPackageLabel"
    from lessons l
    join students s on s.id = l.student_id
    left join invoice_items ii on ii.lesson_id = l.id
    left join invoices inv on inv.id = ii.invoice_id
    left join credit_redemptions cr on cr.lesson_id = l.id
    left join credit_packages cp on cp.id = cr.package_id
    where ${sql.join(conditions, sql` and `)}
    order by l.starts_at
    ${opts.limit ? sql`limit ${opts.limit}` : sql``}
  `);
  return rows as unknown as LessonRow[];
}

export type DashboardData = {
  upcoming: LessonRow[];
  unbilledCount: number;
  unbilledCents: number;
  openInvoiceCents: number;
  monthRevenueCents: number;
  studentCount: number;
  creditUnitsLeft: number;
  creditCentsLeft: number;
};

export async function getDashboard(): Promise<DashboardData> {
  const today = await berlinToday();

  const upcoming = await listLessons({ from: today, status: "planned", limit: 5 });

  const [totals] = await db.execute<{
    unbilledCount: number;
    unbilledCents: number;
    openInvoiceCents: number;
    monthRevenueCents: number;
    studentCount: number;
    creditUnitsLeft: number;
    creditCentsLeft: number;
  }>(sql`
    select
      (select count(*)::int from lessons l where ${OPEN_FOR_BILLING})
        as "unbilledCount",
      (select coalesce(sum(l.price_cents),0)::int from lessons l where ${OPEN_FOR_BILLING})
        as "unbilledCents",
      (select coalesce(sum(total_cents),0)::int from invoices where status = 'open')
        as "openInvoiceCents",
      (select coalesce(sum(total_cents),0)::int from invoices
        where status in ('open','paid')
          and date_trunc('month', issue_date) = date_trunc('month', ${today}::date))
        as "monthRevenueCents",
      (select count(*)::int from students where archived_at is null)
        as "studentCount",
      -- Noch nicht verbrauchte Guthaben, ohne stornierte und abgelaufene
      (select coalesce(sum(p.total_units - coalesce(r.units,0)),0)::int
         from credit_packages p
         left join lateral (select sum(units_used) as units from credit_redemptions
                            where package_id = p.id) r on true
        where p.kind = 'units' and p.cancelled_at is null
          and (p.expires_on is null or p.expires_on >= (now() at time zone 'Europe/Berlin')::date))
        as "creditUnitsLeft",
      (select coalesce(sum(p.credit_cents - coalesce(r.cents,0)),0)::int
         from credit_packages p
         left join lateral (select sum(cents_used) as cents from credit_redemptions
                            where package_id = p.id) r on true
        where p.kind = 'amount' and p.cancelled_at is null
          and (p.expires_on is null or p.expires_on >= (now() at time zone 'Europe/Berlin')::date))
        as "creditCentsLeft"
  `);

  return { upcoming, ...totals! };
}

/** Eine einzelne Stunde mit denselben Feldern wie die Liste. */
export async function getLesson(id: number): Promise<LessonRow | null> {
  const rows = await listLessons({ lessonId: id, limit: 1 });
  return rows[0] ?? null;
}
