"use client";

import { useState } from "react";
import { TOKEN_HELP, previewNumber, validateTemplate } from "@/lib/invoice-number";

/**
 * Eingabefeld für eine Rechnungsnummern-Vorlage mit Live-Vorschau.
 *
 * Die Vorschau ist hier kein Zierrat: eine Vorlage ohne Vorschau tippt man
 * blind, und der erste Beleg, an dem der Fehler auffällt, ist bereits
 * festgeschrieben und nur noch per Storno zu korrigieren.
 */
export function TemplateField({
  name,
  label,
  defaultValue = "",
  placeholder,
  error,
  hint,
  context,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  context?: { firstName?: string; lastName?: string; customerNumber?: number | null };
}) {
  const [wert, setWert] = useState(defaultValue);
  const [hilfeOffen, setHilfeOffen] = useState(false);

  const effektiv = wert.trim() || placeholder || "";
  const fehler = wert.trim() ? validateTemplate(wert) : null;
  const vorschau = effektiv ? previewNumber(effektiv, context) : "—";

  return (
    <div className="form-row full">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={wert}
        onChange={(ev) => setWert(ev.target.value)}
        placeholder={placeholder}
        className={error || fehler ? "invalid" : undefined}
        spellCheck={false}
      />
      <span className="error-msg">{error ?? fehler}</span>

      <p className="template-preview">
        Beispiel: <strong>{vorschau}</strong>
        {!wert.trim() && placeholder && " (aus den Einstellungen)"}
        <button type="button" className="link-button" onClick={() => setHilfeOffen((v) => !v)}>
          {hilfeOffen ? "Platzhalter ausblenden" : "Platzhalter anzeigen"}
        </button>
      </p>

      {hilfeOffen && (
        <ul className="template-help">
          {TOKEN_HELP.map((t) => (
            <li key={t.token}>
              <code>{t.token}</code> {t.beschreibung}
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="hint" style={{ margin: 0 }}>{hint}</p>}
    </div>
  );
}
