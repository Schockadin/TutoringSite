import type { Metadata } from "next";
import Link from "next/link";
import { HoldLessonButton } from "@/components/HoldLessonButton";
import { LESSON_STATUS, date, duration, money, weekday } from "@/lib/format";
import { berlinToday, listLessons } from "@/lib/queries";

export const metadata: Metadata = { title: "Stunden – Verwaltung" };

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; monat?: string }>;
}) {
  const { filter, monat } = await searchParams;
  const today = await berlinToday();
  const month = /^\d{4}-\d{2}$/.test(monat ?? "") ? monat! : today.slice(0, 7);

  const unbilled = filter === "offen";
  const lessons = unbilled
    ? await listLessons({ unbilledOnly: true })
    : await listLessons({ month });

  const total = lessons.reduce((sum, l) => sum + (l.priceCents ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stunden</h1>
          <p className="sub">
            {unbilled
              ? `${lessons.length} noch nicht abgerechnet · ${money(total)}`
              : `${lessons.length} Einträge im gewählten Monat`}
          </p>
        </div>
        <Link href="/app/stunden/neu" className="btn btn-primary btn-sm">
          Stunde eintragen
        </Link>
      </div>

      <form className="toolbar" method="get">
        <Link href="/app/stunden" className={unbilled ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}>
          Nach Monat
        </Link>
        <Link
          href="/app/stunden?filter=offen"
          className={unbilled ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
        >
          Nur offene
        </Link>
        {!unbilled && (
          <>
            <input type="month" name="monat" defaultValue={month} aria-label="Monat" />
            <button type="submit" className="btn btn-secondary btn-sm">
              Anzeigen
            </button>
          </>
        )}
      </form>

      {lessons.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <p>{unbilled ? "Alles abgerechnet." : "In diesem Monat ist nichts eingetragen."}</p>
            <Link href="/app/stunden/neu" className="btn btn-primary btn-sm">
              Stunde eintragen
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Zeit</th>
                <th>Schüler:in</th>
                <th>Dauer</th>
                <th>Thema</th>
                <th>Status</th>
                <th className="num">Preis</th>
                <th className="num">Rechnung</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/app/stunden/${l.id}`}>
                      {weekday(l.dateLocal)} {date(l.dateLocal)}
                    </Link>
                  </td>
                  <td>{l.timeLocal}</td>
                  <td>
                    <Link href={`/app/schueler/${l.studentId}`}>{l.studentName}</Link>
                  </td>
                  <td>{duration(l.durationMinutes)}</td>
                  <td className="wrap">{l.topic ?? l.subject ?? "–"}</td>
                  <td>
                    <span className={`badge badge-${l.status}`}>{LESSON_STATUS[l.status]}</span>
                    {!l.billable && (
                      <span className="badge badge-draft" style={{ marginLeft: 6 }}>
                        nicht berechnet
                      </span>
                    )}
                  </td>
                  <td className="num">{money(l.priceCents)}</td>
                  <td className="num">
                    {l.invoiceId ? (
                      <Link href={`/app/rechnungen/${l.invoiceId}`}>Rechnung</Link>
                    ) : l.status === "planned" ? (
                      <HoldLessonButton id={l.id} compact />
                    ) : (
                      "offen"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={6}>Summe</th>
                <th className="num">{money(total)}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
