"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addItem, type InvoiceFormState } from "@/lib/actions/invoices";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "…" : "Position hinzufügen"}
    </button>
  );
}

export function AddItemForm({ invoiceId }: { invoiceId: number }) {
  const action = addItem.bind(null, invoiceId);
  const [state, formAction] = useActionState<InvoiceFormState, FormData>(action, {});
  const e = state.errors;

  return (
    <form action={formAction}>
      {state.message && (
        <p className={e ? "notice notice-error" : "notice notice-info"}>{state.message}</p>
      )}
      <div className="form-grid">
        <div className="form-row">
          <label htmlFor="description">Bezeichnung</label>
          <input
            id="description"
            name="description"
            className={e?.description ? "invalid" : undefined}
            placeholder="z. B. Fahrtkosten außerhalb Essen"
          />
          <span className="error-msg">{e?.description}</span>
        </div>
        <div className="form-row">
          <label htmlFor="unitPrice">Einzelpreis (€)</label>
          <input
            id="unitPrice"
            name="unitPrice"
            inputMode="decimal"
            className={e?.unitPrice ? "invalid" : undefined}
            placeholder="10,00 oder -5,00"
          />
          <span className="error-msg">
            {e?.unitPrice ?? "Negativ für Rabatte (§ 14 Abs. 4 Nr. 7 UStG)"}
          </span>
        </div>
        <div className="form-row">
          <label htmlFor="quantity">Menge</label>
          <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
          <span className="error-msg">{e?.quantity}</span>
        </div>
        <div className="form-row">
          <label htmlFor="unit">Einheit</label>
          <input id="unit" name="unit" defaultValue="Einheit" />
          <span className="error-msg"></span>
        </div>
      </div>
      <Save />
    </form>
  );
}
