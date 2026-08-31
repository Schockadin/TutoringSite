import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageActions } from "@/components/MessageActions";
import { getMessage, markRead } from "@/lib/actions/contact";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Nachricht – Verwaltung" };

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const message = await getMessage(id);
  if (!message) notFound();

  // Öffnen heißt gelesen. Die Bedingung steckt in der WHERE-Klausel, damit
  // nur beim ersten Mal geschrieben wird.
  if (message.status === "new") await markRead(id);

  return (
    <>
      <Link href="/app/nachrichten" className="back-link">
        &larr; Zurück zum Posteingang
      </Link>

      <div className="page-head">
        <div>
          <h1>{message.name}</h1>
          <p className="sub">
            {date(message.createdAt.slice(0, 10))}
            {message.subject && ` · ${message.subject}`}
          </p>
        </div>
        <a href={`mailto:${message.email}`} className="btn btn-primary btn-sm">
          Per E-Mail antworten
        </a>
      </div>

      {message.notifyError && (
        <p className="notice notice-warn">
          Die Benachrichtigung per E-Mail konnte nicht zugestellt werden: {message.notifyError} Die
          Nachricht selbst ist davon unberührt und vollständig gespeichert.
        </p>
      )}

      <div className="form-section">
        <h2>Kontakt</h2>
        <ul className="contact-list">
          <li>
            <span className="contact-label">E-Mail</span>
            <a href={`mailto:${message.email}`}>{message.email}</a>
          </li>
          {message.phone && (
            <li>
              <span className="contact-label">Telefon</span>
              <a href={`tel:${message.phone.replace(/\s+/g, "")}`}>{message.phone}</a>
            </li>
          )}
        </ul>
      </div>

      <div className="form-section">
        <h2>Nachricht</h2>
        {/* whiteSpace: pre-wrap erhält die Absätze der Absender:in, ohne dass
            dafür HTML aus fremder Eingabe gerendert werden müsste. */}
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.message}</p>
      </div>

      <div className="form-section">
        <h2>Bearbeiten</h2>
        <MessageActions id={id} status={message.status} />
      </div>
    </>
  );
}
