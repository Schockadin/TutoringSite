"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitContactMessage, type ContactState } from "@/lib/actions/contact";

function Senden() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Wird gesendet…" : "Nachricht senden"}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ContactState, FormData>(submitContactMessage, {});
  const e = state.errors;
  const bad = (f: string) => (e?.[f] ? "invalid" : undefined);

  if (state.ok) {
    return (
      <p className="form-note success" role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate>
      {/* Honeypot: für Menschen unsichtbar, für Bots verlockend. Kein
          display:none, weil manche Bots das erkennen - stattdessen aus dem
          Sichtfeld geschoben und für Screenreader ausgeblendet. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website (bitte leer lassen)</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-row">
        <label htmlFor="name">Name *</label>
        <input type="text" id="name" name="name" required className={bad("name")} autoComplete="name" />
        <span className="error-msg">{e?.name}</span>
      </div>

      <div className="form-row">
        <label htmlFor="email">E-Mail *</label>
        <input type="email" id="email" name="email" required className={bad("email")} autoComplete="email" />
        <span className="error-msg">{e?.email}</span>
      </div>

      <div className="form-row">
        <label htmlFor="phone">Telefon (optional)</label>
        <input type="tel" id="phone" name="phone" autoComplete="tel" />
      </div>

      <div className="form-row">
        <label htmlFor="subject">Fach / Thema</label>
        <select id="subject" name="subject" defaultValue="Mathematik">
          <option value="Mathematik">Mathematik</option>
          <option value="Naturwissenschaften">Naturwissenschaften</option>
          <option value="Latein">Latein</option>
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="message">Nachricht *</label>
        <textarea id="message" name="message" rows={5} required className={bad("message")} />
        <span className="error-msg">{e?.message}</span>
      </div>

      <Senden />
      {state.message && !state.ok && (
        <p className="form-note error" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
