import "server-only";

/**
 * Benachrichtigung über neue Kontaktanfragen per Resend.
 *
 * Bewusst ohne SDK: es ist genau ein POST. Die Feldnamen sind gegen das
 * offizielle SDK geprüft - die REST-Schnittstelle erwartet `reply_to` in
 * Schlangenschreibweise, nicht `replyTo`.
 *
 * Der Versand ist ausdrücklich "best effort". Eine Kontaktanfrage darf niemals
 * daran scheitern, dass ein Mailanbieter gerade nicht erreichbar ist: die
 * Nachricht ist zu diesem Zeitpunkt bereits gespeichert. Fehler werden
 * zurückgegeben und an der Nachricht vermerkt, damit sie im Posteingang
 * sichtbar sind statt still zu verschwinden.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

export type NotifyResult = { ok: true } | { ok: false; reason: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyNewMessage(input: {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
}): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  // RESEND_FROM_EMAIL ist die bereits gebräuchliche Schreibweise; RESEND_FROM
  // bleibt als Alias gültig, damit beide Benennungen funktionieren.
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM;
  // Voreinstellung auf die Adresse aus dem Impressum: der Empfänger ist fest
  // und ohnehin öffentlich, und so funktioniert die Benachrichtigung auch
  // dann, wenn die Umgebungsvariable einmal fehlt. NOTIFY_EMAIL überschreibt
  // sie jederzeit.
  const to = process.env.NOTIFY_EMAIL ?? "dominic.zander@outlook.de";

  if (!apiKey || !from || !to) {
    const fehlend = [
      !apiKey ? "RESEND_API_KEY" : null,
      !from ? "RESEND_FROM_EMAIL" : null,
    ].filter(Boolean);
    return { ok: false, reason: `Nicht eingerichtet: ${fehlend.join(", ")} fehlt.` };
  }

  const siteUrl = process.env.SITE_URL ?? "https://dominic-zander.de";
  const link = `${siteUrl}/app/nachrichten/${input.id}`;

  const zeilen = [
    `Name: ${input.name}`,
    `E-Mail: ${input.email}`,
    input.phone ? `Telefon: ${input.phone}` : null,
    input.subject ? `Fach: ${input.subject}` : null,
    "",
    input.message,
    "",
    `Im Verwaltungsbereich öffnen: ${link}`,
  ].filter((z) => z !== null);

  const html = [
    "<h2>Neue Nachricht über das Kontaktformular</h2>",
    "<table cellpadding='4'>",
    `<tr><td><strong>Name</strong></td><td>${escapeHtml(input.name)}</td></tr>`,
    `<tr><td><strong>E-Mail</strong></td><td>${escapeHtml(input.email)}</td></tr>`,
    input.phone ? `<tr><td><strong>Telefon</strong></td><td>${escapeHtml(input.phone)}</td></tr>` : "",
    input.subject ? `<tr><td><strong>Fach</strong></td><td>${escapeHtml(input.subject)}</td></tr>` : "",
    "</table>",
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    `<p><a href="${link}">Im Verwaltungsbereich öffnen</a></p>`,
  ].join("");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Verhindert doppelte Mails, falls die Funktion wiederholt anläuft.
        "Idempotency-Key": `kontakt-${input.id}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        // Antworten gehen direkt an die anfragende Person.
        reply_to: [input.email],
        subject: `Nachhilfe-Anfrage von ${input.name}`,
        text: zeilen.join("\n"),
        html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, reason: `Resend antwortete mit ${response.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? `Zeitüberschreitung nach ${TIMEOUT_MS} ms`
        : err instanceof Error
          ? err.message
          : "Unbekannter Fehler";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
