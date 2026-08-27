import type { Metadata } from "next";
import Link from "next/link";
import { listStudents } from "@/lib/actions/students";
import { money } from "@/lib/format";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const metadata: Metadata = { title: "Schüler:innen – Verwaltung" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  const { archiv } = await searchParams;
  const showArchived = archiv === "1";
  const rows = await listStudents(showArchived);

  // Offene Betraege je Schueler:in in einer Abfrage statt N+1
  const summaries = await db.execute<{
    studentId: number;
    unbilledCount: number;
    unbilledCents: number;
  }>(sql`
    select l.student_id as "studentId",
           count(*)::int as "unbilledCount",
           coalesce(sum(l.price_cents),0)::int as "unbilledCents"
    from lessons l
    left join invoice_items ii on ii.lesson_id = l.id
    where l.billable and l.status in ('held','no_show') and ii.id is null
    group by l.student_id
  `);
  const byStudent = new Map(
    (summaries as unknown as { studentId: number; unbilledCount: number; unbilledCents: number }[]).map(
      (s) => [s.studentId, s],
    ),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schüler:innen</h1>
          <p className="sub">
            {rows.length} {showArchived ? "Einträge inkl. Archiv" : "aktive Einträge"}
          </p>
        </div>
        <Link href="/app/schueler/neu" className="btn btn-primary btn-sm">
          Neue Schüler:in
        </Link>
      </div>

      <div className="toolbar">
        <Link href="/app/schueler" className={showArchived ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}>
          Aktive
        </Link>
        <Link href="/app/schueler?archiv=1" className={showArchived ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>
          Inkl. Archiv
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <p>Noch keine Schüler:innen angelegt.</p>
            <Link href="/app/schueler/neu" className="btn btn-primary btn-sm">
              Erste Schüler:in anlegen
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Klasse</th>
                <th>Fächer</th>
                <th className="num">Offen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const sum = byStudent.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/app/schueler/${s.id}`}>
                        {s.lastName}, {s.firstName}
                      </Link>
                      {s.archivedAt && <span className="badge badge-draft" style={{ marginLeft: 8 }}>archiviert</span>}
                    </td>
                    <td>{s.grade ?? "–"}</td>
                    <td className="wrap">{s.subjects.length > 0 ? s.subjects.join(", ") : "–"}</td>
                    <td className="num">
                      {sum ? `${money(sum.unbilledCents)} (${sum.unbilledCount})` : "–"}
                    </td>
                    <td className="num">
                      <Link href={`/app/schueler/${s.id}`}>Öffnen</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
