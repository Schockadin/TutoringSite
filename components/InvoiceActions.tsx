"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelInvoice, deleteDraft, finalizeInvoice, markPaid, removeItem } from "@/lib/actions/invoices";

export function FinalizeButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ message?: string; missing?: string[] }>({});

  return (
    <>
      {state.message && (
        <div className="notice notice-warn">
          <p style={{ margin: 0 }}>{state.message}</p>
          {state.missing && state.missing.length > 0 && (
            <ul style={{ margin: "8px 0 0 20px" }}>
              {state.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Rechnung festschreiben? Danach erhält sie eine fortlaufende Nummer und ist unveränderlich. Korrekturen sind nur noch per Storno möglich.",
            )
          )
            return;
          start(() => finalizeInvoice(id).then((r) => setState(r)));
        }}
      >
        {pending ? "Wird festgeschrieben…" : "Festschreiben"}
      </button>
    </>
  );
}

export function RemoveItemButton({ invoiceId, itemId }: { invoiceId: number; itemId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      onClick={() => start(() => removeItem(invoiceId, itemId).then(() => undefined))}
    >
      Entfernen
    </button>
  );
}

export function InvoiceLifecycle({
  id,
  status,
  today,
}: {
  id: number;
  status: string;
  today: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const router = useRouter();

  return (
    <>
      {error && <p className="notice notice-error">{error}</p>}

      {status === "open" && (
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="paidOn">Bezahlt am</label>
            <input id="paidOn" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            <span className="error-msg"></span>
          </div>
        </div>
      )}

      <div className="form-actions">
        {status === "open" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending}
            onClick={() => start(() => markPaid(id, paidOn).then((r) => setError(r.error ?? null)))}
          >
            Als bezahlt markieren
          </button>
        )}

        {(status === "open" || status === "paid") && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  "Rechnung stornieren? Es wird eine Stornorechnung mit eigener Nummer erstellt. Die Originalrechnung bleibt erhalten.",
                )
              )
                return;
              start(() =>
                cancelInvoice(id).then((r) => {
                  if (r.error) setError(r.error);
                  else if (r.newId) router.push(`/app/rechnungen/${r.newId}`);
                }),
              );
            }}
          >
            Stornieren
          </button>
        )}

        {status === "draft" && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() => {
              if (!confirm("Entwurf löschen? Es wird keine Rechnungsnummer verbraucht.")) return;
              start(() => deleteDraft(id).then((r) => setError(r?.error ?? null)));
            }}
          >
            Entwurf löschen
          </button>
        )}
      </div>
    </>
  );
}
