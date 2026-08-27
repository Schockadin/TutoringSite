"use client";

import { useState } from "react";

/**
 * Kontaktformular. Verhalten unveraendert aus js/script.js uebernommen:
 * Es wird nichts an einen Server gesendet, sondern ein mailto:-Link geoeffnet.
 * Genau das sagt auch die Datenschutzerklaerung zu – die Aussage bleibt wahr.
 *
 * Hinweis: Diese Adresse weicht von der auf der Seite angezeigten
 * kontakt@dominic-zander.de ab. Das war im Bestand schon so und wurde
 * bewusst nicht stillschweigend geaendert.
 */
const CONTACT_EMAIL = "dominic.zander@outlook.de";

type Errors = { name?: string; email?: string; message?: string };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [note, setNote] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const subject = String(data.get("subject") ?? "");
    const message = String(data.get("message") ?? "").trim();

    const next: Errors = {};
    if (!name) next.name = "Bitte gib deinen Namen ein.";
    if (!email) next.email = "Bitte gib deine E-Mail-Adresse ein.";
    else if (!isValidEmail(email)) next.email = "Bitte gib eine gültige E-Mail-Adresse ein.";
    if (!message) next.message = "Bitte schreib mir kurz, worum es geht.";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setNote({ text: "Bitte überprüfe deine Eingaben.", kind: "error" });
      return;
    }

    const body = [
      `Name: ${name}`,
      `E-Mail: ${email}`,
      phone ? `Telefon: ${phone}` : null,
      `Fach: ${subject}`,
      "",
      message,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const mailto =
      `mailto:${CONTACT_EMAIL}` +
      `?subject=${encodeURIComponent(`Nachhilfe-Anfrage von ${name}`)}` +
      `&body=${encodeURIComponent(body)}`;

    setNote({
      text: `Dein E-Mail-Programm öffnet sich gleich mit deiner Nachricht. Falls nicht, schreib mir gerne direkt an ${CONTACT_EMAIL}.`,
      kind: "success",
    });
    window.location.href = mailto;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <label htmlFor="name">Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className={errors.name ? "invalid" : undefined}
        />
        <span className="error-msg">{errors.name}</span>
      </div>

      <div className="form-row">
        <label htmlFor="email">E-Mail *</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className={errors.email ? "invalid" : undefined}
        />
        <span className="error-msg">{errors.email}</span>
      </div>

      <div className="form-row">
        <label htmlFor="phone">Telefon (optional)</label>
        <input type="tel" id="phone" name="phone" />
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
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className={errors.message ? "invalid" : undefined}
        />
        <span className="error-msg">{errors.message}</span>
      </div>

      <button type="submit" className="btn btn-primary">
        Nachricht senden
      </button>
      {note && (
        <p className={`form-note ${note.kind}`} role="status">
          {note.text}
        </p>
      )}
      {!note && <p className="form-note" role="status"></p>}
    </form>
  );
}
