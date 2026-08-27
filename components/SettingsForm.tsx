"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettings, type SettingsState } from "@/lib/actions/settings";
import type { Settings } from "@/lib/db/schema";
import { TAX_MODE, TAX_NOTE_PRESETS } from "@/lib/format";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird gespeichert…" : "Speichern"}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [taxMode, setTaxMode] = useState(settings.taxMode);
  const [taxNote, setTaxNote] = useState(settings.taxNote);
  const e = state.errors;
  const bad = (f: string) => (e?.[f] ? "invalid" : undefined);

  return (
    <form action={formAction}>
      {state.message && (
        <p className={e ? "notice notice-error" : "notice notice-info"}>{state.message}</p>
      )}

      <div className="form-section">
        <h2>Rechnungssteller</h2>
        <p className="hint">
          Name und Anschrift sind nach § 14 Abs. 4 Nr. 1 UStG auf jeder Rechnung Pflicht.
        </p>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="issuerName">Name *</label>
            <input id="issuerName" name="issuerName" defaultValue={settings.issuerName} className={bad("issuerName")} />
            <span className="error-msg">{e?.issuerName}</span>
          </div>
          <div className="form-row">
            <label htmlFor="issuerStreet">Straße und Hausnummer *</label>
            <input id="issuerStreet" name="issuerStreet" defaultValue={settings.issuerStreet} className={bad("issuerStreet")} />
            <span className="error-msg">{e?.issuerStreet}</span>
          </div>
          <div className="form-row">
            <label htmlFor="issuerPostalCode">PLZ *</label>
            <input id="issuerPostalCode" name="issuerPostalCode" defaultValue={settings.issuerPostalCode} className={bad("issuerPostalCode")} />
            <span className="error-msg">{e?.issuerPostalCode}</span>
          </div>
          <div className="form-row">
            <label htmlFor="issuerCity">Ort *</label>
            <input id="issuerCity" name="issuerCity" defaultValue={settings.issuerCity} className={bad("issuerCity")} />
            <span className="error-msg">{e?.issuerCity}</span>
          </div>
          <div className="form-row">
            <label htmlFor="issuerEmail">E-Mail</label>
            <input id="issuerEmail" name="issuerEmail" defaultValue={settings.issuerEmail} />
            <span className="error-msg"></span>
          </div>
          <div className="form-row">
            <label htmlFor="issuerPhone">Telefon</label>
            <input id="issuerPhone" name="issuerPhone" defaultValue={settings.issuerPhone} />
            <span className="error-msg"></span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Steuer</h2>
        <p className="hint">
          Steuernummer oder USt-IdNr. gehört nach § 14 Abs. 4 Nr. 2 UStG auf jede Rechnung –
          mindestens eines von beiden ist Pflicht. Die Voreinstellung § 4 Nr. 21 UStG entspricht
          der Angabe im Impressum. Ob dieser Befreiungstatbestand tatsächlich greift, sollte mit
          einer Steuerberatung geklärt werden – er setzt in der Regel eine Bescheinigung der
          zuständigen Landesbehörde voraus.
        </p>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="taxNumber">Steuernummer</label>
            <input id="taxNumber" name="taxNumber" defaultValue={settings.taxNumber} className={bad("taxNumber")} />
            <span className="error-msg">{e?.taxNumber}</span>
          </div>
          <div className="form-row">
            <label htmlFor="vatId">USt-IdNr.</label>
            <input id="vatId" name="vatId" defaultValue={settings.vatId} />
            <span className="error-msg"></span>
          </div>
          <div className="form-row">
            <label htmlFor="taxMode">Steuerregime</label>
            <select
              id="taxMode"
              name="taxMode"
              value={taxMode}
              onChange={(ev) => {
                setTaxMode(ev.target.value);
                setTaxNote(TAX_NOTE_PRESETS[ev.target.value]?.note ?? "");
              }}
            >
              {Object.entries(TAX_MODE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="error-msg">{e?.taxMode}</span>
          </div>
          {taxMode === "standard" && (
            <div className="form-row">
              <label htmlFor="taxRateBp">Steuersatz in Basispunkten</label>
              <input id="taxRateBp" name="taxRateBp" type="number" defaultValue={settings.taxRateBp || 1900} />
              <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
                1900 = 19 %
              </span>
            </div>
          )}
          <div className="form-row full">
            <label htmlFor="taxNote">Steuerhinweis auf der Rechnung</label>
            <textarea
              id="taxNote"
              name="taxNote"
              rows={2}
              value={taxNote}
              onChange={(ev) => setTaxNote(ev.target.value)}
            />
            <span className="error-msg"></span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Zahlung und Rechnungsformat</h2>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="bankAccountHolder">Kontoinhaber</label>
            <input id="bankAccountHolder" name="bankAccountHolder" defaultValue={settings.bankAccountHolder} />
            <span className="error-msg"></span>
          </div>
          <div className="form-row">
            <label htmlFor="iban">IBAN</label>
            <input id="iban" name="iban" defaultValue={settings.iban} />
            <span className="error-msg"></span>
          </div>
          <div className="form-row">
            <label htmlFor="bic">BIC</label>
            <input id="bic" name="bic" defaultValue={settings.bic} />
            <span className="error-msg"></span>
          </div>
          <div className="form-row">
            <label htmlFor="paymentTermsDays">Zahlungsziel in Tagen</label>
            <input id="paymentTermsDays" name="paymentTermsDays" type="number" min={0} max={365} defaultValue={settings.paymentTermsDays} />
            <span className="error-msg">{e?.paymentTermsDays}</span>
          </div>
          <div className="form-row">
            <label htmlFor="invoiceNumberPrefix">Präfix der Rechnungsnummer</label>
            <input id="invoiceNumberPrefix" name="invoiceNumberPrefix" defaultValue={settings.invoiceNumberPrefix} />
            <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
              ergibt z. B. RE-2026-0001
            </span>
          </div>
          <div className="form-row full">
            <label htmlFor="invoiceIntroText">Einleitungstext</label>
            <textarea id="invoiceIntroText" name="invoiceIntroText" rows={2} defaultValue={settings.invoiceIntroText} placeholder="z. B. Vielen Dank für die gute Zusammenarbeit." />
            <span className="error-msg"></span>
          </div>
          <div className="form-row full">
            <label htmlFor="invoiceFooterNote">Fußtext</label>
            <textarea id="invoiceFooterNote" name="invoiceFooterNote" rows={2} defaultValue={settings.invoiceFooterNote} />
            <span className="error-msg"></span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Save />
      </div>
    </form>
  );
}
