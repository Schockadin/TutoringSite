"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { saveTariff, toggleTariff, type SettingsState } from "@/lib/actions/settings";
import type { Tariff } from "@/lib/db/schema";
import { duration, money } from "@/lib/format";

function Add() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "…" : "Tarif anlegen"}
    </button>
  );
}

function ToggleButton({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      onClick={() => start(() => toggleTariff(id, !active))}
    >
      {active ? "Deaktivieren" : "Aktivieren"}
    </button>
  );
}

export function TariffList({ tariffs }: { tariffs: Tariff[] }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(saveTariff, {});
  const e = state.errors;

  return (
    <div className="form-section">
      <h2>Tarife</h2>
      <p className="hint">
        Der Tarif bestimmt den Preis einer Stunde – nicht ein Stundensatz mal Dauer. Das ist
        wichtig, weil 90 Minuten laut Preisliste 45 € kosten und nicht 52,50 €. Tarife werden nie
        gelöscht, sondern nur deaktiviert, damit alte Stunden ihre Herkunft behalten.
      </p>

      <div className="table-wrap" style={{ marginBottom: "var(--space-5)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Dauer</th>
              <th className="num">Preis</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tariffs.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{duration(t.durationMinutes)}</td>
                <td className="num">{money(t.priceCents)}</td>
                <td>
                  <span className={t.active ? "badge badge-paid" : "badge badge-draft"}>
                    {t.active ? "aktiv" : "inaktiv"}
                  </span>
                </td>
                <td className="num">
                  <ToggleButton id={t.id} active={t.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={formAction}>
        {state.message && <p className="notice notice-info">{state.message}</p>}
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="name">Bezeichnung</label>
            <input id="name" name="name" className={e?.name ? "invalid" : undefined} placeholder="z. B. Abiturvorbereitung 120 Minuten" />
            <span className="error-msg">{e?.name}</span>
          </div>
          <div className="form-row">
            <label htmlFor="durationMinutes">Dauer in Minuten</label>
            <input id="durationMinutes" name="durationMinutes" type="number" min={1} max={600} defaultValue={60} />
            <span className="error-msg">{e?.durationMinutes}</span>
          </div>
          <div className="form-row">
            <label htmlFor="priceCents">Preis (€)</label>
            <input id="priceCents" name="priceCents" inputMode="decimal" className={e?.priceCents ? "invalid" : undefined} placeholder="35,00" />
            <span className="error-msg">{e?.priceCents}</span>
          </div>
        </div>
        <Add />
      </form>
    </div>
  );
}
