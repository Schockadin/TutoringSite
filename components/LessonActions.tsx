"use client";

import { useState, useTransition } from "react";
import { cancelLesson, deleteLesson } from "@/lib/actions/lessons";

export function LessonActions({ id, locked }: { id: number; locked: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      {error && <p className="notice notice-error">{error}</p>}

      <div className="form-row">
        <label htmlFor="reason">Grund der Absage</label>
        <input
          id="reason"
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
          placeholder="z. B. krank, kurzfristig abgesagt"
        />
        <span className="error-msg"></span>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || locked}
          onClick={() => start(() => cancelLesson(id, reason, false).then((r) => setError(r.error ?? null)))}
        >
          Absagen (nicht berechnen)
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || locked}
          onClick={() => start(() => cancelLesson(id, reason, true).then((r) => setError(r.error ?? null)))}
        >
          Nicht erschienen (berechnen)
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("Diese Stunde wirklich löschen?")) return;
            start(() => deleteLesson(id).then((r) => setError(r?.error ?? null)));
          }}
        >
          Löschen
        </button>
      </div>
    </>
  );
}
