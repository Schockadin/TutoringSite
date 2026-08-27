"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { db, settings, tariffs } from "@/lib/db";
import { TAX_NOTE_PRESETS } from "@/lib/format";
import * as v from "@/lib/validate";

export type SettingsState = { errors?: v.FieldErrors; message?: string };

export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row!;
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();
  const errors: v.FieldErrors = {};

  const taxMode = String(formData.get("taxMode") ?? "exempt_4_21");
  if (!TAX_NOTE_PRESETS[taxMode]) {
    errors.taxMode = "Unbekanntes Steuerregime.";
  }

  const taxNote = v.text(formData.get("taxNote"), { max: 500 }) ?? TAX_NOTE_PRESETS[taxMode]!.note;
  const taxRateBp =
    taxMode === "standard"
      ? (v.integer(errors, "taxRateBp", formData.get("taxRateBp"), "den Steuersatz in Basispunkten", {
          min: 0,
          max: 10000,
          allowEmpty: true,
          fallback: 1900,
        }) ?? 1900)
      : 0;

  const values = {
    issuerName: v.required(errors, "issuerName", formData.get("issuerName"), "den Namen", 120),
    issuerStreet: v.required(errors, "issuerStreet", formData.get("issuerStreet"), "die Straße", 120),
    issuerPostalCode: v.required(errors, "issuerPostalCode", formData.get("issuerPostalCode"), "die PLZ", 10),
    issuerCity: v.required(errors, "issuerCity", formData.get("issuerCity"), "den Ort", 80),
    issuerEmail: v.text(formData.get("issuerEmail"), { max: 120 }) ?? "",
    issuerPhone: v.text(formData.get("issuerPhone"), { max: 50 }) ?? "",
    taxNumber: v.text(formData.get("taxNumber"), { max: 40 }) ?? "",
    vatId: v.text(formData.get("vatId"), { max: 40 }) ?? "",
    taxMode,
    taxRateBp,
    taxNote,
    bankAccountHolder: v.text(formData.get("bankAccountHolder"), { max: 120 }) ?? "",
    iban: (v.text(formData.get("iban"), { max: 40 }) ?? "").replace(/\s+/g, ""),
    bic: v.text(formData.get("bic"), { max: 20 }) ?? "",
    paymentTermsDays:
      v.integer(errors, "paymentTermsDays", formData.get("paymentTermsDays"), "das Zahlungsziel", {
        min: 0,
        max: 365,
        allowEmpty: true,
        fallback: 14,
      }) ?? 14,
    invoiceNumberPrefix: v.text(formData.get("invoiceNumberPrefix"), { max: 10 }) ?? "RE",
    invoiceIntroText: v.text(formData.get("invoiceIntroText"), { max: 1000 }) ?? "",
    invoiceFooterNote: v.text(formData.get("invoiceFooterNote"), { max: 1000 }) ?? "",
  };

  // Mindestens eine Steuerkennung ist nach § 14 Abs. 4 Nr. 2 UStG Pflicht.
  if (!values.taxNumber && !values.vatId) {
    errors.taxNumber = "Steuernummer oder USt-IdNr. ist auf jeder Rechnung Pflicht (§ 14 UStG).";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe die markierten Felder." };
  }

  await db.update(settings).set(values).where(eq(settings.id, 1));
  revalidatePath("/app/einstellungen");
  return { message: "Gespeichert." };
}

export async function listAllTariffs() {
  return db.select().from(tariffs).orderBy(asc(tariffs.sortOrder));
}

export async function saveTariff(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();
  const errors: v.FieldErrors = {};
  const name = v.required(errors, "name", formData.get("name"), "eine Bezeichnung", 100);
  const durationMinutes =
    v.integer(errors, "durationMinutes", formData.get("durationMinutes"), "die Dauer", {
      min: 1,
      max: 600,
    }) ?? 60;
  const priceCents = v.euroToCents(errors, "priceCents", formData.get("priceCents"), "den Preis", {
    allowEmpty: false,
  });

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await db.insert(tariffs).values({ name, durationMinutes, priceCents: priceCents!, sortOrder: 100 });
  } catch {
    return { errors: { name: "Diesen Tarifnamen gibt es bereits." } };
  }

  revalidatePath("/app/einstellungen");
  return { message: "Tarif angelegt." };
}

/**
 * Tarife werden nie geloescht, sondern nur deaktiviert: sie sind aus alten
 * Stunden heraus referenziert und ein Loeschen wuerde deren Herkunft
 * verwischen.
 */
export async function toggleTariff(id: number, active: boolean) {
  await requireSession();
  await db.update(tariffs).set({ active }).where(eq(tariffs.id, id));
  revalidatePath("/app/einstellungen");
}
