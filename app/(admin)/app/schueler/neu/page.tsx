import type { Metadata } from "next";
import Link from "next/link";
import { StudentForm } from "@/components/StudentForm";
import { createStudent, listActiveTariffs } from "@/lib/actions/students";
import { getSettings } from "@/lib/actions/settings";

export const metadata: Metadata = { title: "Neue Schüler:in – Verwaltung" };

export default async function NewStudentPage() {
  const [tariffs, settings] = await Promise.all([listActiveTariffs(), getSettings()]);

  return (
    <>
      <Link href="/app/schueler" className="back-link">
        &larr; Zurück zur Liste
      </Link>
      <div className="page-head">
        <h1>Neue Schüler:in</h1>
      </div>
      <StudentForm action={createStudent} tariffs={tariffs} submitLabel="Anlegen" settingsTemplate={settings.invoiceNumberTemplate} />
    </>
  );
}
