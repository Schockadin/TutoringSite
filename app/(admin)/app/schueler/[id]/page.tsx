import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentActions } from "@/components/StudentActions";
import { StudentForm } from "@/components/StudentForm";
import {
  getStudent,
  getStudentSummary,
  listActiveTariffs,
  updateStudent,
} from "@/lib/actions/students";
import { LESSON_STATUS, billingName, date, duration, money, studentName } from "@/lib/format";
import { listLessons } from "@/lib/queries";

export const metadata: Metadata = { title: "Schüler:in – Verwaltung" };

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const student = await getStudent(id);
  if (!student) notFound();

  const [tariffs, summary, lessons] = await Promise.all([
    listActiveTariffs(),
    getStudentSummary(id),
    listLessons({ studentId: id, limit: 25 }),
  ]);

  const update = updateStudent.bind(null, id);

  return (
    <>
      <Link href="/app/schueler" className="back-link">
        &larr; Zurück zur Liste
      </Link>

      <div className="page-head">
        <div>
          <h1>{studentName(student)}</h1>
          <p className="sub">
            Rechnungsempfänger: {billingName(student)}
            {student.archivedAt && " · archiviert"}
          </p>
        </div>
        <Link href={`/app/stunden/neu?student=${id}`} className="btn btn-primary btn-sm">
          Termin anlegen
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <p className="stat-label">Stunden gesamt</p>
          <p className="stat-value">{summary.lessonCount}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Offene Stunden</p>
          <p className="stat-value">{summary.unbilledCount}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Nicht abgerechnet</p>
          <p className="stat-value">{money(summary.unbilledCents)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Offene Rechnungen</p>
          <p className={summary.openInvoiceCents > 0 ? "stat-value" : "stat-value muted"}>
            {money(summary.openInvoiceCents)}
          </p>
        </div>
      </div>

      {summary.unbilledCount > 0 && (
        <p className="notice notice-info">
          {summary.unbilledCount === 1 ? "Eine Stunde wartet" : `${summary.unbilledCount} Stunden warten`} auf
          die Abrechnung.{" "}
          <Link href={`/app/rechnungen/neu?student=${id}`}>Rechnung erstellen</Link>
        </p>
      )}

      <StudentForm action={update} student={student} tariffs={tariffs} submitLabel="Speichern" />

      <div className="form-section">
        <h2>Letzte Stunden und Termine</h2>
        {lessons.length === 0 ? (
          <p className="hint">Noch nichts eingetragen.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Zeit</th>
                  <th>Dauer</th>
                  <th>Thema</th>
                  <th>Status</th>
                  <th className="num">Preis</th>
                  <th>Rechnung</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/app/stunden/${l.id}`}>{date(l.dateLocal)}</Link>
                    </td>
                    <td>{l.timeLocal}</td>
                    <td>{duration(l.durationMinutes)}</td>
                    <td className="wrap">{l.topic ?? l.subject ?? "–"}</td>
                    <td>
                      <span className={`badge badge-${l.status}`}>{LESSON_STATUS[l.status]}</span>
                    </td>
                    <td className="num">{money(l.priceCents)}</td>
                    <td>
                      {l.invoiceId ? (
                        <Link href={`/app/rechnungen/${l.invoiceId}`}>Rechnung</Link>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Archiv und Löschung</h2>
        <p className="hint">
          Archivieren blendet die Schüler:in aus den Listen aus, erhält aber alle Daten.
          Endgültiges Löschen ist nur möglich, solange keine Stunden und keine Rechnungen
          vorliegen – abgerechnete Leistungen unterliegen der steuerlichen Aufbewahrungspflicht.
        </p>
        <StudentActions id={id} archived={student.archivedAt !== null} />
      </div>
    </>
  );
}
