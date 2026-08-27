import type { Metadata } from "next";
import Link from "next/link";
import { LessonForm } from "@/components/LessonForm";
import { createLesson } from "@/lib/actions/lessons";
import { listActiveTariffs, listStudents } from "@/lib/actions/students";
import { berlinToday } from "@/lib/queries";

export const metadata: Metadata = { title: "Termin anlegen – Verwaltung" };

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
            dateLocal: /^\d{4}-\d{2}-\d{2}$/.test(datum ?? "") ? datum : today,
            studentId: Number(student) || undefined,
          }}
          submitLabel="Anlegen"
        />
      )}
    </>
  );
}
