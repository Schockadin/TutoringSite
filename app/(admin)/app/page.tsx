import type { Metadata } from "next";
import Link from "next/link";
import { LESSON_STATUS, date, duration, money, weekday } from "@/lib/format";
import { getDashboard } from "@/lib/queries";

export const metadata: Metadata = { title: "Übersicht – Verwaltung" };

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Übersicht</h1>
          <p className="sub">Was gerade ansteht und was noch abzurechnen ist.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <p className="stat-label">Schüler:innen</p>
          <p className="stat-value">{data.studentCount}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Offene Stunden</p>
          <p className="stat-value">{data.unbilledCount}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Noch nicht abgerechnet</p>
          <p className="stat-value">{money(data.unbilledCents)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Offene Rechnungen</p>
          <p className={data.openInvoiceCents > 0 ? "stat-value" : "stat-value muted"}>
            {money(data.openInvoiceCents)}
          </p>
        </div>
      </div>

      <div className="page-head">
        <h2 style={{ fontSize: "1.2rem", textAlign: "left", margin: 0 }}>Nächste Termine</h2>
        <Link href="/app/kalender" className="btn btn-secondary btn-sm">
          Zum Kalender
        </Link>
      </div>

      {data.upcoming.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <p>Keine kommenden Termine eingetragen.</p>
            <Link href="/app/kalender" className="btn btn-primary btn-sm">
              Termin anlegen
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
                <th>Fach</th>
                <th>Dauer</th>
                <th className="num">Preis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.map((lesson) => (
                <tr key={lesson.id}>
                  <td>
                    {weekday(lesson.dateLocal)} {date(lesson.dateLocal)}
                  </td>
                  <td>{lesson.timeLocal}</td>
                  <td>
                    <Link href={`/app/schueler/${lesson.studentId}`}>{lesson.studentName}</Link>
                  </td>
                  <td>{lesson.subject ?? "–"}</td>
                  <td>{duration(lesson.durationMinutes)}</td>
                  <td className="num">{money(lesson.priceCents)}</td>
                  <td>
                    <span className={`badge badge-${lesson.status}`}>
                      {LESSON_STATUS[lesson.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.unbilledCount > 0 && (
        <p className="notice notice-info" style={{ marginTop: "var(--space-5)" }}>
          Es {data.unbilledCount === 1 ? "wartet eine Stunde" : `warten ${data.unbilledCount} Stunden`}{" "}
          auf die Abrechnung ({money(data.unbilledCents)}).{" "}
          <Link href="/app/rechnungen">Rechnung erstellen</Link>
        </p>
      )}
    </>
  );
}
