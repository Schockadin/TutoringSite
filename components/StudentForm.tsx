"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { StudentFormState } from "@/lib/actions/students";
import type { Student, Tariff } from "@/lib/db/schema";
import { money } from "@/lib/format";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird gespeichert…" : label}
    </button>
  );
}

function Field({
  name,
  label,
  errors,
  children,
  full,
  hint,
}: {
  name: string;
  label: string;
  errors?: Record<string, string>;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <div className={full ? "form-row full" : "form-row"}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !errors?.[name] && (
        <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </span>
      )}
      {(!hint || errors?.[name]) && <span className="error-msg">{errors?.[name]}</span>}
    </div>
  );
}

export function StudentForm({
  action,
  student,
  tariffs,
  submitLabel,
}: {
  action: (prev: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  student?: Student;
  tariffs: Tariff[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<StudentFormState, FormData>(action, {});
  const e = state.errors;
  const bad = (f: string) => (e?.[f] ? "invalid" : undefined);

  return (
    <form action={formAction}>
      {state.message && (
        <p className={e ? "notice notice-error" : "notice notice-info"}>{state.message}</p>
      )}

      <div className="form-section">
        <h2>Schüler:in</h2>
        <div className="form-grid">
          <Field name="firstName" label="Vorname *" errors={e}>
            <input id="firstName" name="firstName" defaultValue={student?.firstName} className={bad("firstName")} required />
          </Field>
          <Field name="lastName" label="Nachname *" errors={e}>
            <input id="lastName" name="lastName" defaultValue={student?.lastName} className={bad("lastName")} required />
          </Field>
          <Field name="grade" label="Klassenstufe" errors={e}>
            <input id="grade" name="grade" defaultValue={student?.grade ?? ""} placeholder="z. B. 9" />
          </Field>
          <Field name="school" label="Schule" errors={e}>
            <input id="school" name="school" defaultValue={student?.school ?? ""} />
          </Field>
          <Field name="subjects" label="Fächer" errors={e} full hint="Mehrere durch Komma trennen">
            <input
              id="subjects"
              name="subjects"
              defaultValue={student?.subjects?.join(", ") ?? ""}
              placeholder="Mathematik, Physik"
            />
          </Field>
          <Field name="studentEmail" label="E-Mail (Schüler:in)" errors={e}>
            <input id="studentEmail" name="studentEmail" type="email" defaultValue={student?.studentEmail ?? ""} className={bad("studentEmail")} />
          </Field>
          <Field name="studentPhone" label="Telefon (Schüler:in)" errors={e}>
            <input id="studentPhone" name="studentPhone" type="tel" defaultValue={student?.studentPhone ?? ""} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <h2>Rechnungsempfänger</h2>
        <p className="hint">
          In der Regel die Eltern – Minderjährige sind normalerweise nicht Vertragspartner.
          Name und Anschrift erscheinen auf der Rechnung und sind dort nach § 14 UStG Pflicht.
          Bleibt das Feld leer, wird der Name der Schüler:in verwendet.
        </p>
        <div className="form-grid">
          <Field name="billingName" label="Name" errors={e}>
            <input id="billingName" name="billingName" defaultValue={student?.billingName ?? ""} placeholder="Familie Muster" />
          </Field>
          <Field name="billingEmail" label="E-Mail" errors={e}>
            <input id="billingEmail" name="billingEmail" type="email" defaultValue={student?.billingEmail ?? ""} className={bad("billingEmail")} />
          </Field>
          <Field name="billingPhone" label="Telefon" errors={e}>
            <input id="billingPhone" name="billingPhone" type="tel" defaultValue={student?.billingPhone ?? ""} />
          </Field>
          <Field name="billingStreet" label="Straße und Hausnummer" errors={e}>
            <input id="billingStreet" name="billingStreet" defaultValue={student?.billingStreet ?? ""} />
          </Field>
          <Field name="billingPostalCode" label="PLZ" errors={e}>
            <input id="billingPostalCode" name="billingPostalCode" defaultValue={student?.billingPostalCode ?? ""} />
          </Field>
          <Field name="billingCity" label="Ort" errors={e}>
            <input id="billingCity" name="billingCity" defaultValue={student?.billingCity ?? ""} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <h2>Abrechnung</h2>
        <p className="hint">
          Der Tarif bestimmt den Preis einer Stunde. Der Stundensatz greift nur als Rückfallebene,
          wenn für eine Dauer kein Tarif hinterlegt ist.
        </p>
        <div className="form-grid">
          <Field name="defaultTariffId" label="Standardtarif" errors={e}>
            <select id="defaultTariffId" name="defaultTariffId" defaultValue={student?.defaultTariffId ?? ""}>
              <option value="">– kein Standardtarif –</option>
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {money(t.priceCents)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="hourlyRateCents" label="Stundensatz (€, optional)" errors={e}>
            <input
              id="hourlyRateCents"
              name="hourlyRateCents"
              inputMode="decimal"
              defaultValue={student?.hourlyRateCents != null ? (student.hourlyRateCents / 100).toFixed(2).replace(".", ",") : ""}
              className={bad("hourlyRateCents")}
              placeholder="35,00"
            />
          </Field>
          <Field name="notes" label="Notizen" errors={e} full>
            <textarea id="notes" name="notes" rows={4} defaultValue={student?.notes ?? ""} />
          </Field>
        </div>
      </div>

      <div className="form-actions">
        <Save label={submitLabel} />
        <Link href={student ? `/app/schueler/${student.id}` : "/app/schueler"} className="btn btn-secondary">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
