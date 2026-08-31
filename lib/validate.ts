/**
 * Handgeschriebene Feldpruefung statt einer Schema-Bibliothek.
 * Die Meldungen muessen ohnehin deutsch und fachlich formuliert sein, damit
 * spart eine Bibliothek weniger, als sie an Abhaengigkeit kostet.
 */

export type FieldErrors = Record<string, string>;

export function text(
  value: FormDataEntryValue | null,
  opts: { max?: number } = {},
): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return opts.max ? s.slice(0, opts.max) : s;
}

export function required(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  label: string,
  max = 100,
): string {
  const s = String(value ?? "").trim();
  if (!s) {
    errors[field] = `Bitte ${label} angeben.`;
    return "";
  }
  if (s.length > max) {
    errors[field] = `${label} darf höchstens ${max} Zeichen lang sein.`;
    return s;
  }
  return s;
}

/** "35" oder "35,50" oder "35.50" -> 3550 Cent. Leer -> null. */
export function euroToCents(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  label: string,
  { allowEmpty = true } = {},
): number | null {
  const s = String(value ?? "").trim().replace(",", ".");
  if (!s) {
    if (!allowEmpty) errors[field] = `Bitte ${label} angeben.`;
    return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    errors[field] = `${label} muss eine Zahl ab 0 sein.`;
    return null;
  }
  // Ueber Cent runden, damit 35,555 nicht zu einem krummen Betrag wird.
  return Math.round(n * 100);
}

export function integer(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  label: string,
  { min = 1, max = 600, allowEmpty = false, fallback = null as number | null } = {},
): number | null {
  const s = String(value ?? "").trim();
  if (!s) {
    if (!allowEmpty) errors[field] = `Bitte ${label} angeben.`;
    return fallback;
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors[field] = `${label} muss zwischen ${min} und ${max} liegen.`;
    return fallback;
  }
  return n;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function dateField(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  label: string,
): string {
  const s = String(value ?? "").trim();
  if (!DATE_RE.test(s)) {
    errors[field] = `Bitte ${label} angeben.`;
    return "";
  }
  return s;
}

export function timeField(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  label: string,
): string {
  const s = String(value ?? "").trim();
  if (!TIME_RE.test(s)) {
    errors[field] = `Bitte ${label} als HH:MM angeben.`;
    return "";
  }
  return s;
}

export function email(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    errors[field] = "Bitte eine gültige E-Mail-Adresse angeben.";
  }
  return s;
}

/** Komma- oder Zeilengetrennte Faecherliste zu einem sauberen Array. */
export function subjects(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}
