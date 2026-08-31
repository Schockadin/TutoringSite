"use server";

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { contactMessages, db } from "@/lib/db";
import { notifyNewMessage } from "@/lib/notify";
import * as v from "@/lib/validate";

/**
 * Das Kontaktformular der öffentlichen Seite.
 *
 * Einziger Schreibzugriff im System, der ohne Anmeldung möglich ist. Der
 * CSRF-Schutz kommt von Next.js selbst (Server Actions prüfen Origin gegen
 * Host); gegen Spam und Missbrauch stehen hier eine Honeypot-Falle und zwei
 * Drosselungen.
 */

const MAX_PRO_STUNDE_GESAMT = 20;
const MAX_PRO_STUNDE_JE_ADRESSE = 3;

export type ContactState = { errors?: v.FieldErrors; ok?: boolean; message?: string };

export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: ein für Menschen unsichtbares Feld. Ist es ausgefüllt, war es
  // ein Bot. Wir melden trotzdem Erfolg, damit der Bot nichts dazulernt.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { ok: true, message: "Danke für deine Nachricht! Ich melde mich zeitnah zurück." };
  }

  const errors: v.FieldErrors = {};
  const name = v.required(errors, "name", formData.get("name"), "deinen Namen", 120);
  const email = v.email(errors, "email", formData.get("email"));
  if (!email) errors.email = "Bitte gib deine E-Mail-Adresse ein.";
  const message = v.required(errors, "message", formData.get("message"), "eine Nachricht", 5000);

  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe deine Eingaben." };
  }

  const eineStundeZurueck = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [limits] = await db
    .select({
      gesamt: sql<number>`count(*)::int`,
      jeAdresse: sql<number>`count(*) filter (where lower(email) = lower(${email}))::int`,
    })
    .from(contactMessages)
    .where(gt(contactMessages.createdAt, eineStundeZurueck));

  if (limits && limits.gesamt >= MAX_PRO_STUNDE_GESAMT) {
    return {
      message:
        "Aktuell gehen sehr viele Nachrichten ein. Bitte versuche es in einer Stunde erneut " +
        "oder schreib direkt an dominic.zander@outlook.de.",
    };
  }
  if (limits && limits.jeAdresse >= MAX_PRO_STUNDE_JE_ADRESSE) {
    return {
      message:
        "Von dieser Adresse sind gerade mehrere Nachrichten eingegangen. Bitte warte kurz ab – " +
        "ich habe sie erhalten und melde mich.",
    };
  }

  const [row] = await db
    .insert(contactMessages)
    .values({
      name,
      email: email!,
      phone: v.text(formData.get("phone"), { max: 60 }),
      subject: v.text(formData.get("subject"), { max: 100 }),
      message,
    })
    .returning({ id: contactMessages.id });

  // Ab hier ist die Nachricht sicher gespeichert. Der Mailversand darf sie
  // nicht mehr gefährden - deshalb best effort und ohne throw.
  const notify = await notifyNewMessage({
    id: row!.id,
    name,
    email: email!,
    phone: v.text(formData.get("phone"), { max: 60 }),
    subject: v.text(formData.get("subject"), { max: 100 }),
    message,
  });

  await db
    .update(contactMessages)
    .set(
      notify.ok
        ? { notifiedAt: new Date().toISOString(), notifyError: null }
        : { notifyError: notify.reason },
    )
    .where(eq(contactMessages.id, row!.id));

  if (!notify.ok) {
    // Nur ins Serverlog: die anfragende Person geht das nichts an, ihre
    // Nachricht ist ja angekommen.
    console.error("[Benachrichtigung]", notify.reason);
  }

  revalidatePath("/app/nachrichten");
  revalidatePath("/app");

  return { ok: true, message: "Danke für deine Nachricht! Ich melde mich zeitnah zurück." };
}

/* ------------------------------------------------------------- Posteingang */

export async function listMessages(includeArchived = false) {
  return db
    .select()
    .from(contactMessages)
    .where(includeArchived ? undefined : sql`${contactMessages.status} <> 'archived'`)
    .orderBy(desc(contactMessages.createdAt));
}

export async function getMessage(id: number) {
  const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  return row ?? null;
}

export async function countUnread(): Promise<number> {
  const [row] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(contactMessages)
    .where(eq(contactMessages.status, "new"));
  return row?.anzahl ?? 0;
}

/**
 * Markiert eine Nachricht beim Öffnen als gelesen.
 *
 * Bewusst OHNE revalidatePath: diese Funktion wird beim Rendern der
 * Detailseite aufgerufen, und Next.js verbietet dort das Revalidieren
 * ("used revalidatePath during render which is unsupported"). Der Aufrufer
 * sieht den neuen Stand ohnehin unmittelbar, und die Liste lädt beim nächsten
 * Aufruf neu, weil der Verwaltungsbereich durchgehend dynamisch rendert.
 */
export async function markRead(id: number) {
  await requireSession();
  await db
    .update(contactMessages)
    .set({ status: "read", readAt: new Date().toISOString() })
    .where(and(eq(contactMessages.id, id), eq(contactMessages.status, "new")));
}

export async function setMessageStatus(id: number, status: "new" | "read" | "archived") {
  await requireSession();
  const now = new Date().toISOString();
  await db
    .update(contactMessages)
    .set({
      status,
      readAt: status === "new" ? null : now,
      archivedAt: status === "archived" ? now : null,
    })
    .where(eq(contactMessages.id, id));
  revalidatePath("/app/nachrichten");
  revalidatePath(`/app/nachrichten/${id}`);
  revalidatePath("/app");
}

/**
 * Endgültiges Löschen. Anders als bei Stunden und Rechnungen gibt es hier
 * keine Aufbewahrungspflicht - eine unverbindliche Anfrage ist kein
 * Buchungsbeleg. Art. 17 DSGVO greift also ungehindert.
 */
export async function deleteMessage(id: number) {
  await requireSession();
  await db.delete(contactMessages).where(eq(contactMessages.id, id));
  revalidatePath("/app/nachrichten");
  revalidatePath("/app");
}
