/**
 * Die EINZIGE Stelle, an der Statuswerte ins Deutsche uebersetzt werden.
 * In Datenbank und Code heissen sie durchgehend englisch; deutsche Beschriftungen
 * gibt es nur hier und in den Seitentexten selbst.
 */

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateLong = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const weekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

/** Cent-Betrag als deutscher Euro-Betrag, z. B. 4500 -> "45,00 €". */
export function money(cents: number | null | undefined): string {
  return euro.format((cents ?? 0) / 100);
}

/** "2026-09-14" -> "14.09.2026". Rein string-basiert, keine Zeitzonenarithmetik. */
export function date(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "–";
  return dateLong.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "2026-09-14" -> "Mo." */
export function weekday(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return weekdayShort.format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/** 90 -> "1,5 Std." bzw. 45 -> "45 Min." */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = minutes / 60;
  const text = Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1).replace(".", ",");
  return `${text} Std.`;
}

export const LESSON_STATUS: Record<string, string> = {
  planned: "Termin",
  held: "gehalten",
  cancelled: "abgesagt",
  no_show: "nicht erschienen",
};

export const INVOICE_STATUS: Record<string, string> = {
  draft: "Entwurf",
  open: "offen",
  paid: "bezahlt",
  cancelled: "storniert",
};

export const TAX_MODE: Record<string, string> = {
  exempt_4_21: "Steuerbefreit nach § 4 Nr. 21 UStG",
  small_business_19: "Kleinunternehmer nach § 19 UStG",
  standard: "Regelbesteuerung",
};

/** Voreingestellte Steuerhinweise je Regime. Frei ueberschreibbar. */
export const TAX_NOTE_PRESETS: Record<string, { note: string; rateBp: number }> = {
  exempt_4_21: {
    note: "Umsatzsteuerbefreit gemäß § 4 Nr. 21 Buchst. b UStG.",
    rateBp: 0,
  },
  small_business_19: {
    note: "Kein Steuerausweis aufgrund der Anwendung der Kleinunternehmerregelung nach § 19 UStG.",
    rateBp: 0,
  },
  standard: { note: "Im Betrag enthaltene Umsatzsteuer: 19 %", rateBp: 1900 },
};

export function studentName(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`;
}

/** Rechnungsempfaenger: die Eltern, ersatzweise der Schuelername. */
export function billingName(s: {
  firstName: string;
  lastName: string;
  billingName: string | null;
}): string {
  return s.billingName?.trim() || studentName(s);
}
