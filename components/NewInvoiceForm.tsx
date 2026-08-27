"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createDraft, type InvoiceFormState } from "@/lib/actions/invoices";
import type { Student } from "@/lib/db/schema";
import { studentName } from "@/lib/format";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird erstellt…" : "Entwurf erstellen"}
    </button>
  );
}

export function NewInvoiceForm({
  students,
  defaults,
}: {
  students: Student[];
  defaults: { studentId?: number; periodStart: string; periodEnd: string };
}) {
  const [state, formAction] = useActionState<InvoiceFormState, FormData>(createDraft, {});
  const e = state.errors;

  return (
    <form action={formAction}>
      {state.message && <p className="notice notice-error">{state.message}</p>}

      <div className="form-section">
        <p className="hint">
          Der Entwurf übernimmt automatisch alle noch nicht abgerechneten Stunden der
          Schüler:in im gewählten Zeitraum. Jede Stunde wird als eigene Position mit ihrem
          Datum geführt – das erfüllt § 14 Abs. 4 Nr. 6 UStG ohne Auslegungsspielraum.
        </p>
        <div className="form-grid">
          <div className="form-row full">
            <label htmlFor="studentId">Schüler:in *</label>
            <select
              id="studentId"
              name="studentId"
              defaultValue={defaults.studentId ?? ""}
              className={e?.studentId ? "invalid" : undefined}
              required
            >
              <option value="">– bitte wählen –</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)}
                </option>
              ))}
            </select>
            <span className="error-msg">{e?.studentId}</span>
          </div>

          <div className="form-row">
            <label htmlFor="periodStart">Leistungszeitraum von *</label>
            <input id="periodStart" name="periodStart" type="date" defaultValue={defaults.periodStart} required />
            <span className="error-msg">{e?.periodStart}</span>
          </div>

          <div className="form-row">
            <label htmlFor="periodEnd">bis *</label>
            <input id="periodEnd" name="periodEnd" type="date" defaultValue={defaults.periodEnd} required />
            <span className="error-msg">{e?.periodEnd}</span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Save />
      </div>
    </form>
  );
}
