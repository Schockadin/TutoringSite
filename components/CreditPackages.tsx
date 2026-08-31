"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelPackage,
  createPackage,
  setPackagePaid,
  type PackageState,
  type PackageWithBalance,
} from "@/lib/actions/credits";
import { date, duration, money } from "@/lib/format";

function Add() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "…" : "Guthaben anlegen"}
    </button>
  );
}

/** Verbleibender Rest, je nach Guthabenart als Einheiten oder als Betrag. */
function Remaining({ p }: { p: PackageWithBalance }) {
  if (p.cancelledAt) return <span className="badge badge-cancelled">storniert</span>;
  if (p.expired) return <span className="badge badge-cancelled">abgelaufen</span>;

  if (p.kind === "units") {
    const left = p.remainingUnits ?? 0;
    return (
      <span className={left > 0 ? "badge badge-paid" : "badge badge-draft"}>
        {left} von {p.totalUnits} übrig
      </span>
    );
  }
  const left = p.remainingCents ?? 0;
  return (
    <span className={left > 0 ? "badge badge-paid" : "badge badge-draft"}>
      {money(left)} von {money(p.creditCents)} übrig
    </span>
  );
}

function PackageRow({ p }: { p: PackageWithBalance }) {
  const [pending, start] = useTransition();

  return (
    <tr>
      <td className="wrap">
        <strong>{p.label}</strong>
        <br />
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          {p.kind === "units"
            ? `${p.totalUnits} × ${duration(p.unitDurationMinutes ?? 60)}`
            : `Guthaben ${money(p.creditCents)}`}
          {" · gekauft "}
          {date(p.purchasedOn)}
          {p.expiresOn && ` · gültig bis ${date(p.expiresOn)}`}
        </span>
      </td>
      <td>
        <Remaining p={p} />
        {p.redemptionCount > 0 && (
          <>
            <br />
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              {p.redemptionCount} {p.redemptionCount === 1 ? "Stunde" : "Stunden"} verrechnet
            </span>
          </>
        )}
      </td>
      <td className="num">{money(p.priceCents)}</td>
      <td>
        {p.paidOn ? (
          <span className="badge badge-paid">bezahlt {date(p.paidOn)}</span>
        ) : p.invoiceId ? (
          <Link href={`/app/rechnungen/${p.invoiceId}`}>berechnet</Link>
        ) : (
          <span className="badge badge-open">offen</span>
        )}
      </td>
      <td className="num">
        {!p.paidOn && !p.cancelledAt && (
          <button
            type="button"
            className="link-button"
            disabled={pending}
            onClick={() =>
              start(() => setPackagePaid(p.id, new Date().toISOString().slice(0, 10)))
            }
          >
            Bezahlt
          </button>
        )}{" "}
        <button
          type="button"
          className="link-button"
          disabled={pending}
          onClick={() => {
            if (
              !p.cancelledAt &&
              !confirm(
                "Guthaben stornieren? Bereits verrechnete Stunden bleiben verrechnet – nur der Rest verfällt.",
              )
            )
              return;
            start(() => cancelPackage(p.id).then(() => undefined));
          }}
        >
          {p.cancelledAt ? "Reaktivieren" : "Stornieren"}
        </button>
      </td>
    </tr>
  );
}

export function CreditPackages({
  studentId,
  packages,
  today,
}: {
  studentId: number;
  packages: PackageWithBalance[];
  today: string;
}) {
  const action = createPackage.bind(null, studentId);
  const [state, formAction] = useActionState<PackageState, FormData>(action, {});
  const [kind, setKind] = useState("units");
  const e = state.errors;

  return (
    <div className="form-section">
      <h2>Guthaben und Vorauszahlungen</h2>
      <p className="hint">
        Vorausbezahlte Stunden. Wird ein Termin als gehalten markiert, greift ein passendes
        Guthaben automatisch – die Stunde erscheint dann nicht mehr in der offenen Abrechnung,
        weil sie bereits bezahlt ist. Berechnet wird stattdessen das Guthaben selbst, einmal.
      </p>

      {packages.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: "var(--space-5)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Guthaben</th>
                <th>Rest</th>
                <th className="num">Preis</th>
                <th>Zahlung</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <PackageRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={formAction}>
        {state.message && (
          <p className={e ? "notice notice-error" : "notice notice-info"}>{state.message}</p>
        )}

        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="kind">Art</label>
            <select id="kind" name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="units">Stundenkontingent</option>
              <option value="amount">Geldguthaben</option>
            </select>
            <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
              {kind === "units"
                ? "z. B. 5er-Karte: 5 Einheiten à 60 Minuten"
                : "Freie Anzahlung, wird pro Stunde abgebucht"}
            </span>
          </div>

          <div className="form-row">
            <label htmlFor="label">Bezeichnung *</label>
            <input
              id="label"
              name="label"
              className={e?.label ? "invalid" : undefined}
              placeholder={kind === "units" ? "5er-Karte 60 Minuten" : "Vorauszahlung"}
            />
            <span className="error-msg">{e?.label}</span>
          </div>

          {kind === "units" ? (
            <>
              <div className="form-row">
                <label htmlFor="totalUnits">Anzahl Einheiten *</label>
                <input
                  id="totalUnits"
                  name="totalUnits"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={5}
                  className={e?.totalUnits ? "invalid" : undefined}
                />
                <span className="error-msg">{e?.totalUnits}</span>
              </div>
              <div className="form-row">
                <label htmlFor="unitDurationMinutes">Dauer je Einheit (Minuten) *</label>
                <input
                  id="unitDurationMinutes"
                  name="unitDurationMinutes"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={60}
                  className={e?.unitDurationMinutes ? "invalid" : undefined}
                />
                <span className="error-msg">
                  {e?.unitDurationMinutes ?? "Muss zur Dauer der Stunden passen"}
                </span>
              </div>
            </>
          ) : (
            <div className="form-row">
              <label htmlFor="creditCents">Guthaben (€) *</label>
              <input
                id="creditCents"
                name="creditCents"
                inputMode="decimal"
                className={e?.creditCents ? "invalid" : undefined}
                placeholder="300,00"
              />
              <span className="error-msg">{e?.creditCents}</span>
            </div>
          )}

          <div className="form-row">
            <label htmlFor="priceCents">Preis (€) *</label>
            <input
              id="priceCents"
              name="priceCents"
              inputMode="decimal"
              className={e?.priceCents ? "invalid" : undefined}
              placeholder={kind === "units" ? "150,00" : "300,00"}
            />
            <span className="error-msg">
              {e?.priceCents ?? "Darf vom Guthaben abweichen – so lässt sich ein Rabatt abbilden"}
            </span>
          </div>

          <div className="form-row">
            <label htmlFor="purchasedOn">Gekauft am *</label>
            <input
              id="purchasedOn"
              name="purchasedOn"
              type="date"
              defaultValue={today}
              className={e?.purchasedOn ? "invalid" : undefined}
            />
            <span className="error-msg">{e?.purchasedOn}</span>
          </div>

          <div className="form-row">
            <label htmlFor="paidOn">Bezahlt am</label>
            <input id="paidOn" name="paidOn" type="date" className={e?.paidOn ? "invalid" : undefined} />
            <span className="error-msg">{e?.paidOn ?? "Leer lassen, wenn noch offen"}</span>
          </div>

          <div className="form-row">
            <label htmlFor="expiresOn">Gültig bis</label>
            <input id="expiresOn" name="expiresOn" type="date" className={e?.expiresOn ? "invalid" : undefined} />
            <span className="error-msg">{e?.expiresOn ?? "Leer lassen, wenn es nicht verfällt"}</span>
          </div>

          <div className="form-row full">
            <label htmlFor="notes">Notiz</label>
            <input id="notes" name="notes" />
            <span className="error-msg"></span>
          </div>
        </div>

        <Add />
      </form>
    </div>
  );
}
