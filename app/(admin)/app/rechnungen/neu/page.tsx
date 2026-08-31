import type { Metadata } from "next";
import Link from "next/link";
import { NewInvoiceForm } from "@/components/NewInvoiceForm";
import { listStudents } from "@/lib/actions/students";
import { berlinToday } from "@/lib/queries";

export const metadata: Metadata = { title: "Rechnung erstellen – Verwaltung" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student } = await searchParams;
  const [students, today] = await Promise.all([listStudents(), berlinToday()]);

  // Voreinstellung: der laufende Monat
  const [y, m] = today.split("-").map(Number);
  const periodStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const periodEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return (
    <>
      <Link href="/app/rechnungen" className="back-link">
        &larr; Zurück zur Übersicht
      </Link>
      <div className="page-head">
        <h1>Rechnung erstellen</h1>
      </div>
      {students.length === 0 ? (
        <p className="notice notice-warn">
          Es sind noch keine Schüler:innen angelegt.{" "}
          <Link href="/app/schueler/neu">Zuerst eine Schüler:in anlegen</Link>
        </p>
      ) : (
        <NewInvoiceForm
          students={students}
          defaults={{ studentId: Number(student) || undefined, periodStart, periodEnd }}
        />
      )}
    </>
  );
}
