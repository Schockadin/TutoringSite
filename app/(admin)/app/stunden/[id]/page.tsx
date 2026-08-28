import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { HoldLessonButton } from "@/components/HoldLessonButton";
import { LessonActions } from "@/components/LessonActions";
import { LessonForm } from "@/components/LessonForm";
import { updateLesson } from "@/lib/actions/lessons";
import { listActiveTariffs, listStudents } from "@/lib/actions/students";
import { db, invoiceItems, invoices } from "@/lib/db";
import { LESSON_STATUS, date, money } from "@/lib/format";
import { getLesson } from "@/lib/queries";
import { SeriesActions } from "@/components/SeriesActions";
import { getSeries, getSeriesSummary } from "@/lib/actions/series";

export const metadata: Metadata = { title: "Stunde – Verwaltung" };

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warnung?: string }>;
}) {
  const { id: raw } = await params;
  const { warnung } = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const lesson = await getLesson(id);
  if (!lesson) notFound();

  const [students, tariffs] = await Promise.all([listStudents(true), listActiveTariffs()]);

  const [invoiceLink] = await db
    .select({ invoiceId: invoices.id, status: invoices.status, number: invoices.number })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(eq(invoiceItems.lessonId, id))
    .limit(1);

  const locked = invoiceLink !== undefined && invoiceLink.status !== "draft";
  const update = updateLesson.bind(null, id);

  // Serienzugehoerigkeit, falls vorhanden
  const series = lesson.seriesId ? await getSeries(lesson.seriesId) : null;
  const seriesSummary = series ? await getSeriesSummary(series.id) : null;

  return (
    <>
      <Link href="/app/kalender" className="back-link">
        &larr; Zurück zum Kalender
      </Link>

      <div className="page-head">
        <div>
          <h1>
            {date(lesson.dateLocal)} · {lesson.timeLocal}
          </h1>
          <p className="sub">
            {lesson.studentName} · <span className={`badge badge-${lesson.status}`}>{LESSON_STATUS[lesson.status]}</span>{" "}
            · {money(lesson.priceCents)}
          </p>
        </div>
        {lesson.status === "planned" && <HoldLessonButton id={id} />}
      </div>

      {warnung && (
        <p className="notice notice-warn">
          Achtung: Dieser Termin überschneidet sich mit {warnung}. Das ist erlaubt – prüfe nur,
          ob es so gewollt ist.
        </p>
      )}

      {invoiceLink && (
        <p className={locked ? "notice notice-warn" : "notice notice-info"}>
          {locked ? (
            <>
              Diese Stunde ist auf Rechnung {invoiceLink.number} festgeschrieben und deshalb
              unveränderlich.
            </>
          ) : (
            <>Diese Stunde steht auf einem Rechnungsentwurf.</>
          )}{" "}
          <Link href={`/app/rechnungen/${invoiceLink.invoiceId}`}>Zur Rechnung</Link>
        </p>
      )}

      <LessonForm
        action={update}
        students={students}
        tariffs={tariffs}
        defaults={{
          id,
          studentId: lesson.studentId,
          dateLocal: lesson.dateLocal,
          timeLocal: lesson.timeLocal,
          durationMinutes: lesson.durationMinutes,
          status: lesson.status,
          billable: lesson.billable,
          subject: lesson.subject,
          location: lesson.location,
          topic: lesson.topic,
          priceCents: lesson.priceCents,
          locked,
        }}
        submitLabel="Speichern"
      />

      {series && seriesSummary && (
        <div className="form-section">
          <h2>Terminserie</h2>
          <p className="hint">
            Dieser Termin gehört zu einer Serie:{" "}
            {series.intervalWeeks === 1
              ? "wöchentlich"
              : `alle ${series.intervalWeeks} Wochen`}{" "}
            um {series.timeLocal} Uhr, {seriesSummary.total} Termine insgesamt,{" "}
            {seriesSummary.upcoming} davon noch offen.
            {series.endedAt && " Die Serie ist beendet."}
            {" "}Änderungen an diesem Termin betreffen nur ihn – die übrigen bleiben unberührt.
          </p>
          {!series.endedAt && (
            <SeriesActions
              seriesId={series.id}
              untilDate={series.untilDate}
              upcoming={seriesSummary.upcoming}
              billed={seriesSummary.billed}
            />
          )}
        </div>
      )}

      {!locked && (
        <div className="form-section">
          <h2>Absagen oder löschen</h2>
          <p className="hint">
            „Nicht erschienen" bleibt abrechenbar, eine reguläre Absage nicht. Löschen ist nur
            möglich, solange die Stunde auf keiner Rechnung steht.
          </p>
          <LessonActions id={id} locked={locked} />
        </div>
      )}
    </>
  );
}
