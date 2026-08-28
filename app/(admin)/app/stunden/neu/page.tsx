import type { Metadata } from "next";
import Link from "next/link";
import { LessonForm } from "@/components/LessonForm";
import { createLesson } from "@/lib/actions/lessons";
import { listActiveTariffs, listStudents } from "@/lib/actions/students";
import { berlinToday } from "@/lib/queries";

export const metadata: Metadata = { title: "Termin anlegen – Verwaltung" };

/** Reine UTC-Arithmetik: in UTC ist ein Tag immer exakt 86.400.000 ms. */
function plusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; student?: string }>;
}) {
  const { datum, student } = await searchParams;
  const [students, tariffs, today] = await Promise.all([
    listStudents(),
    listActiveTariffs(),
    berlinToday(),
  ]);

  const start = /^\d{4}-\d{2}-\d{2}$/.test(datum ?? "") ? datum! : today;

  return (
    <>
      <Link href="/app/kalender" className="back-link">
        &larr; Zurück zum Kalender
      </Link>
      <div className="page-head">
        <h1>Termin anlegen</h1>
      </div>

      {students.length === 0 ? (
        <p className="notice notice-warn">
          Es sind noch keine Schüler:innen angelegt.{" "}
          <Link href="/app/schueler/neu">Zuerst eine Schüler:in anlegen</Link>
        </p>
      ) : (
        <LessonForm
          action={createLesson}
          students={students}
          tariffs={tariffs}
          defaults={{
            dateLocal: start,
            studentId: Number(student) || undefined,
            // Voreinstellung fuer Serien: ein knappes Halbjahr, das deckt in
            // aller Regel ein Schulhalbjahr ab.
            repeatUntil: plusDays(start, 182),
          }}
          submitLabel="Anlegen"
          allowSeries
        />
      )}
    </>
  );
}
