import type { Metadata } from "next";
import Link from "next/link";
import { HoldLessonButton } from "@/components/HoldLessonButton";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  gridRange,
  monthLabel,
  parseMonth,
  shiftMonth,
} from "@/lib/calendar";
import { LESSON_STATUS, money } from "@/lib/format";
import { berlinToday, listLessons } from "@/lib/queries";

export const metadata: Metadata = { title: "Kalender – Verwaltung" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string; serie?: string }>;
}) {
  const { monat, serie } = await searchParams;
  const today = await berlinToday();
  const { year, month } = parseMonth(monat, today);

  const cells = buildMonthGrid(year, month);
  const { from, to } = gridRange(cells);
  const lessons = await listLessons({ from, to });

  const byDate = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const list = byDate.get(lesson.dateLocal) ?? [];
    list.push(lesson);
    byDate.set(lesson.dateLocal, list);
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kalender</h1>
          <p className="sub">{monthLabel(year, month)}</p>
        </div>
        <Link href="/app/stunden/neu" className="btn btn-primary btn-sm">
          Termin anlegen
        </Link>
      </div>

      {serie && Number(serie) > 0 && (
        <p className="notice notice-info">
          Serie angelegt: {serie} Termine wurden eingetragen. Jeder davon lässt sich einzeln
          verschieben, absagen oder abrechnen.
        </p>
      )}

      <div className="toolbar">
        <Link href={`/app/kalender?monat=${prev}`} className="btn btn-secondary btn-sm">
          &larr; Vorheriger
        </Link>
        <Link href="/app/kalender" className="btn btn-secondary btn-sm">
          Heute
        </Link>
        <Link href={`/app/kalender?monat=${next}`} className="btn btn-secondary btn-sm">
          Nächster &rarr;
        </Link>
      </div>

      {/* Monatsgitter: ab Tablet abwaerts als Agenda-Liste, weil sieben Spalten
          auf dem Telefon unbenutzbar sind. */}
      <div className="calendar-grid" role="grid" aria-label={monthLabel(year, month)}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const dayLessons = byDate.get(cell.iso) ?? [];
          const classes = [
            "calendar-day",
            cell.inMonth ? "" : "other-month",
            cell.iso === today ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={cell.iso} className={classes}>
              <div className="calendar-daynum">
                <Link href={`/app/stunden/neu?datum=${cell.iso}`} title="Termin an diesem Tag anlegen">
                  {cell.dayOfMonth}
                </Link>
              </div>
              {dayLessons.map((l) => (
                <div key={l.id} className={`calendar-event ${l.status}`}>
                  <Link href={`/app/stunden/${l.id}`}>
                    <strong>{l.timeLocal}</strong> {l.studentName}
                    {l.seriesId && (
                      <span className="series-mark" title="Teil einer Serie">
                        ↻
                      </span>
                    )}
                  </Link>
                  {l.status === "planned" && <HoldLessonButton id={l.id} compact />}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Agenda-Liste fuer schmale Bildschirme */}
      <div className="calendar-agenda">
        {lessons.filter((l) => l.dateLocal.startsWith(`${year}-${String(month).padStart(2, "0")}`)).length ===
        0 ? (
          <p className="empty-state">In diesem Monat sind keine Termine eingetragen.</p>
        ) : (
          <ul>
            {lessons
              .filter((l) => l.dateLocal.startsWith(`${year}-${String(month).padStart(2, "0")}`))
              .map((l) => (
                <li key={l.id}>
                  <Link href={`/app/stunden/${l.id}`}>
                    <strong>
                      {l.dateLocal.slice(8)}.{l.dateLocal.slice(5, 7)}. {l.timeLocal}
                    </strong>{" "}
                    {l.studentName}
                  </Link>
                  <span className={`badge badge-${l.status}`}>{LESSON_STATUS[l.status]}</span>
                  <span className="agenda-price">{money(l.priceCents)}</span>
                  {l.status === "planned" && <HoldLessonButton id={l.id} compact />}
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}
