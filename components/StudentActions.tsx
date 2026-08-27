"use client";

import { useState, useTransition } from "react";
import { archiveStudent, deleteStudent } from "@/lib/actions/students";

export function StudentActions({ id, archived }: { id: number; archived: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && <p className="notice notice-error">{error}</p>}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => start(() => archiveStudent(id, !archived).then(() => setError(null)))}
        >
          {archived ? "Aus dem Archiv holen" : "Archivieren"}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Endgültig löschen? Das ist nur möglich, solange keine Stunden und keine Rechnungen vorliegen.",
              )
            )
              return;
            start(() =>
              deleteStudent(id).then((r) => setError(r?.error ?? null)),
            );
          }}
        >
          Endgültig löschen
        </button>
      </div>
    </>
  );
}
