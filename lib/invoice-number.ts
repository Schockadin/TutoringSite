/**
 * Rechnungsnummern aus einer Vorlage.
 *
 * Die Vorlage besteht aus festem Text und Platzhaltern in geschweiften
 * Klammern, z. B. "{INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}" ergibt "LM-01/26-0901".
 *
 * Der entscheidende Kniff: der Zählerbereich wird NICHT festverdrahtet, sondern
 * aus der Vorlage abgeleitet. Er ist die gerenderte Vorlage ohne die laufende
 * Nummer. Damit folgt das Verhalten automatisch der Vorlage:
 *
 *   {INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}  ->  je Schüler:in und Monat
 *   {INITIALEN}-{KUNDENNR}/{LFD}           ->  je Schüler:in, durchlaufend
 *   RE-{YYYY}-{LFD:4}                      ->  global je Jahr
 *
 * Rechtlich verlangt § 14 Abs. 4 Nr. 4 UStG eine einmalige Nummer, nicht
 * zwingend eine lückenlose. Getrennte Nummernkreise je Kundschaft sind
 * ausdrücklich zulässig. Die Einmaligkeit sichert der eindeutige Index auf
 * invoices.number ab, die Lückenlosigkeit je Bereich der transaktionale Zähler.
 */

export const DEFAULT_TEMPLATE = "{INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}";

export type TemplateContext = {
  firstName: string;
  lastName: string;
  customerNumber: number | null;
  /** Ausstellungsdatum als "YYYY-MM-DD". */
  issueDate: string;
};

/** Alle unterstützten Platzhalter, für Hilfetexte in der Oberfläche. */
export const TOKEN_HELP: { token: string; beschreibung: string }[] = [
  { token: "{INITIALEN}", beschreibung: "Initialen der Schüler:in, z. B. LM" },
  { token: "{KUNDENNR}", beschreibung: "Kundennummer, zweistellig, z. B. 01" },
  { token: "{NACHNAME}", beschreibung: "Nachname in Großbuchstaben" },
  { token: "{YY}", beschreibung: "Jahr zweistellig, z. B. 26" },
  { token: "{YYYY}", beschreibung: "Jahr vierstellig, z. B. 2026" },
  { token: "{MM}", beschreibung: "Monat, z. B. 09" },
  { token: "{DD}", beschreibung: "Tag, z. B. 14" },
  { token: "{LFD}", beschreibung: "Laufende Nummer, zweistellig – Pflicht" },
  { token: "{LFD:3}", beschreibung: "Laufende Nummer mit anderer Stellenzahl" },
];

/**
 * Umlaute und ß werden umgeschrieben, damit eine Rechnungsnummer aus
 * Buchstaben besteht, die sich überall unfallfrei tippen und übertragen lassen.
 */
function transliterate(value: string): string {
  return value
    .replace(/Ä/g, "A").replace(/Ö/g, "O").replace(/Ü/g, "U")
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function initials(firstName: string, lastName: string): string {
  const buchstaben = [firstName, lastName]
    .map((teil) => transliterate(teil).replace(/[^A-Za-z]/g, ""))
    .map((teil) => teil.charAt(0).toUpperCase())
    .filter(Boolean);
  // Ohne verwertbare Buchstaben lieber ein sichtbarer Platzhalter als eine
  // stillschweigend verstümmelte Nummer.
  return buchstaben.join("") || "XX";
}

const TOKEN_RE = /\{([A-Z]+)(?::(\d+))?\}/g;

export class TemplateError extends Error {}

/**
 * Rendert die Vorlage. `seq` weggelassen liefert den Zählerbereich, also die
 * Nummer ohne laufende Nummer - genau der Schlüssel, unter dem gezählt wird.
 */
export function renderTemplate(
  template: string,
  ctx: TemplateContext,
  seq?: number,
): string {
  const [year, month, day] = ctx.issueDate.slice(0, 10).split("-");

  return template.replace(TOKEN_RE, (_treffer, name: string, breite?: string) => {
    switch (name) {
      case "INITIALEN":
        return initials(ctx.firstName, ctx.lastName);
      case "NACHNAME":
        return transliterate(ctx.lastName).replace(/[^A-Za-z]/g, "").toUpperCase();
      case "KUNDENNR":
        return String(ctx.customerNumber ?? 0).padStart(2, "0");
      case "YY":
        return (year ?? "").slice(2);
      case "YYYY":
        return year ?? "";
      case "MM":
        return month ?? "";
      case "DD":
        return day ?? "";
      case "LFD":
        // Im Bereichsmodus (ohne seq) fällt die laufende Nummer weg.
        return seq === undefined ? "" : String(seq).padStart(Number(breite ?? 2), "0");
      default:
        throw new TemplateError(`Unbekannter Platzhalter {${name}}`);
    }
  });
}

/** Der Schlüssel, unter dem gezählt wird: die Nummer ohne laufende Nummer. */
export function counterScope(template: string, ctx: TemplateContext): string {
  return renderTemplate(template, ctx);
}

/**
 * Prüft eine Vorlage, bevor sie gespeichert wird. Gibt eine deutsche
 * Fehlermeldung zurück oder null, wenn alles passt.
 */
export function validateTemplate(template: string): string | null {
  const wert = template.trim();
  if (!wert) return "Bitte eine Vorlage angeben.";
  if (wert.length > 100) return "Die Vorlage darf höchstens 100 Zeichen lang sein.";

  const treffer = [...wert.matchAll(TOKEN_RE)];
  const bekannt = new Set(["INITIALEN", "NACHNAME", "KUNDENNR", "YY", "YYYY", "MM", "DD", "LFD"]);

  for (const t of treffer) {
    if (!bekannt.has(t[1]!)) return `Unbekannter Platzhalter {${t[1]}}.`;
    if (t[1] === "LFD" && t[2] && (Number(t[2]) < 1 || Number(t[2]) > 8)) {
      return "Die Stellenzahl der laufenden Nummer muss zwischen 1 und 8 liegen.";
    }
  }

  const lfd = treffer.filter((t) => t[1] === "LFD");
  if (lfd.length === 0) {
    return "Die Vorlage muss {LFD} enthalten – sonst wäre die Nummer nicht eindeutig.";
  }
  if (lfd.length > 1) return "Die Vorlage darf {LFD} nur einmal enthalten.";

  // Klammern ausserhalb gültiger Platzhalter deuten auf einen Tippfehler hin.
  const ohneToken = wert.replace(TOKEN_RE, "");
  if (ohneToken.includes("{") || ohneToken.includes("}")) {
    return "Geschweifte Klammern gehören nur um Platzhalter. Bitte Schreibweise prüfen.";
  }

  return null;
}

/** Beispielnummer für die Vorschau in der Oberfläche. */
export function previewNumber(template: string, ctx?: Partial<TemplateContext>): string {
  const fehler = validateTemplate(template);
  if (fehler) return "—";
  try {
    return renderTemplate(
      template,
      {
        firstName: ctx?.firstName ?? "Lena",
        lastName: ctx?.lastName ?? "Muster",
        customerNumber: ctx?.customerNumber ?? 1,
        issueDate: ctx?.issueDate ?? "2026-09-14",
      },
      1,
    );
  } catch {
    return "—";
  }
}
