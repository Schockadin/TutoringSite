"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { LessonFormState } from "@/lib/actions/lessons";
import type { Student, Tariff } from "@/lib/db/schema";
import { LESSON_STATUS, money, studentName } from "@/lib/format";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird gespeichert…" : label}
    </button>
  );
}

export type LessonDefaults = {
  id?: number;
  studentId?: number;
  dateLocal?: string;
  timeLocal?: string;
  durationMinutes?: number;
  status?: string;
  billable?: boolean;
  subject?: string | null;
  location?: string | null;
  topic?: string | null;
  notes?: string | null;
  priceCents?: number | null;
  tariffId?: number | null;
  locked?: boolean;
};

export function LessonForm({
  action,
  students,
  tariffs,
  defaults,
  submitLabel,
}: {
  action: (prev: LessonFormState, formData: FormData) => Promise<LessonFormState>;
  students: Student[];
  tariffs: Tariff[];
  defaults: LessonDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<LessonFormState, FormData>(action, {});
  const e = state.errors;
  const bad = (f: string) => (e?.[f] ? "invalid" : undefined);

  if (defaults.locked) {
    return (
      <p className="notice notice-warn">
        Diese Stunde gehört zu einer festgeschriebenen Rechnung und ist deshalb unveränderlich.
        Eine Korrektur ist nur über eine Stornorechnung möglich.
      </p>
    );
  }

  return (
    <form action={formAction}>
      {state.message && (
        <p className={e ? "notice notice-error" : "notice notice-info"}>{state.message}</p>
      )}

      <div className="form-section">
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="studentId">Schüler:in *</label>
            <select
              id="studentId"
              name="studentId"
              defaultValue={defaults.studentId ?? ""}
              className={bad("studentId")}
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
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={defaults.status ?? "planned"}>
              {Object.entries(LESSON_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="error-msg"></span>
          </div>

          <div className="form-row">
            <label htmlFor="date">Datum *</label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={defaults.dateLocal}
              className={bad("date")}
              required
            />
            <span className="error-msg">{e?.date}</span>
          </div>

          <div className="form-row">
            <label htmlFor="time">Uhrzeit *</label>
            <input
              id="time"
              name="time"
              type="time"
              defaultValue={defaults.timeLocal ?? "16:00"}
              className={bad("time")}
              required
            />
            <span className="error-msg">{e?.time}</span>
          </div>

          <div className="form-row">
            <label htmlFor="durationMinutes">Dauer in Minuten *</label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={1}
              max={600}
              // step bewusst 1: mit step={5} und min={1} waeren nur 1, 6, 11 ...
              // gueltig, und ausgerechnet 90 Minuten - eine der beiden
              // Standardleistungen - liesse sich nicht absenden. Der Browser
              // blockiert das wortlos.
              step={1}
              defaultValue={defaults.durationMinutes ?? 60}
              className={bad("durationMinutes")}
              required
            />
            <span className="error-msg">{e?.durationMinutes}</span>
          </div>

          <div className="form-row">
            <label htmlFor="tariffId">Tarif</label>
            <select id="tariffId" name="tariffId" defaultValue={defaults.tariffId ?? ""}>
              <option value="">– automatisch nach Dauer –</option>
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {money(t.priceCents)}
                </option>
              ))}
            </select>
            <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
              Ohne Auswahl wird der Tarif anhand der Dauer bestimmt
            </span>
          </div>

          <div className="form-row">
            <label htmlFor="priceCents">Preis (€, überschreibt den Tarif)</label>
            <input
              id="priceCents"
              name="priceCents"
              inputMode="decimal"
              defaultValue={
                defaults.priceCents != null
                  ? (defaults.priceCents / 100).toFixed(2).replace(".", ",")
                  : ""
              }
              className={bad("priceCents")}
              placeholder="automatisch"
            />
            <span className="error-msg">{e?.priceCents}</span>
          </div>

          <div className="form-row">
            <label htmlFor="subject">Fach</label>
            <input id="subject" name="subject" defaultValue={defaults.subject ?? ""} />
            <span className="error-msg"></span>
          </div>

          <div className="form-row">
            <label htmlFor="location">Ort</label>
            <input
              id="location"
              name="location"
              defaultValue={defaults.location ?? ""}
              placeholder="z. B. bei der Schüler:in"
            />
            <span className="error-msg"></span>
          </div>

          <div className="form-row">
            <label htmlFor="billable">Abrechenbar</label>
            <label style={{ fontWeight: 400, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="billable"
                name="billable"
                type="checkbox"
                defaultChecked={defaults.billable ?? true}
                style={{ width: "auto" }}
              />
              Diese Stunde wird berechnet
            </label>
            <span className="error-msg"></span>
          </div>

          <div className="form-row full">
            <label htmlFor="topic">Behandeltes Thema</label>
            <input id="topic" name="topic" defaultValue={defaults.topic ?? ""} />
            <span className="error-msg"></span>
          </div>

          <div className="form-row full">
            <label htmlFor="notes">Notizen</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
            <span className="error-msg"></span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Save label={submitLabel} />
        <Link href="/app/kalender" className="btn btn-secondary">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
