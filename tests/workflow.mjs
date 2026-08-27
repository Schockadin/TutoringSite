/**
 * Durchgaengiger Test des Kernablaufs: Termin -> gehaltene Stunde ->
 * Monatsrechnung -> Druckansicht.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/workflow.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPasswort2026!";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failed = 0;
const ok = (l) => console.log(`  OK    ${l}`);
const bad = (l, extra = "") => {
  console.log(`  FEHLER ${l} ${extra}`);
  failed++;
};

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();

// --- Anmelden -------------------------------------------------------------
await page.goto(`${BASE}/login`);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 15000 });
ok("Angemeldet");

// --- Schüler:in anlegen ---------------------------------------------------
await page.goto(`${BASE}/app/schueler/neu`);
await page.fill("#firstName", "Lena");
await page.fill("#lastName", "Muster");
await page.fill("#grade", "9");
await page.fill("#subjects", "Mathematik, Physik");
await page.fill("#billingName", "Familie Muster");
await page.fill("#billingStreet", "Musterweg 1");
await page.fill("#billingPostalCode", "45329");
await page.fill("#billingCity", "Essen");
// Bewusst nicht button[type=submit]: der erste davon im DOM ist "Abmelden"
// in der Navigation.
await page.click('button:has-text("Anlegen")');
await page.waitForURL(/\/app\/schueler\/\d+$/, { timeout: 15000 });
const studentId = Number(page.url().match(/\/(\d+)$/)[1]);
ok(`Schüler:in angelegt (id ${studentId})`);

// --- Termin anlegen: 90 Minuten -------------------------------------------
await page.goto(`${BASE}/app/stunden/neu?student=${studentId}`);
await page.selectOption("#studentId", String(studentId));
await page.fill("#date", "2026-09-14");
await page.fill("#time", "17:00");
await page.fill("#durationMinutes", "90");
await page.fill("#subject", "Mathematik");
await page.click('button:has-text("Anlegen")');
await page.waitForURL(/\/app\/stunden\/\d+/, { timeout: 15000 });
const lessonId = Number(page.url().match(/\/stunden\/(\d+)/)[1]);

// Der zentrale fachliche Test: 90 Minuten kosten 45 EUR, nicht 52,50 EUR
const priceText = await page.textContent(".page-head .sub");
priceText?.includes("45,00")
  ? ok("90 Minuten ergeben 45,00 € (Tariftabelle, nicht Dauer × Stundensatz)")
  : bad("Preis falsch aufgelöst", priceText ?? "");

const timeShown = await page.textContent("h1");
timeShown?.includes("17:00") ? ok("Uhrzeit korrekt (17:00)") : bad("Uhrzeit falsch", timeShown ?? "");

// --- Termin -> gehaltene Stunde per Klick ---------------------------------
await page.click('button:has-text("Als gehalten markieren")');
await page.waitForTimeout(1500);
await page.reload();
const status = await page.textContent(".page-head .sub");
status?.includes("gehalten") ? ok("Ein Klick: Termin ist jetzt gehaltene Stunde") : bad("Status nicht geändert", status ?? "");

// --- Rechnungsentwurf erstellen -------------------------------------------
await page.goto(`${BASE}/app/rechnungen/neu?student=${studentId}`);
await page.selectOption("#studentId", String(studentId));
await page.fill("#periodStart", "2026-09-01");
await page.fill("#periodEnd", "2026-09-30");
await page.click('button:has-text("Entwurf erstellen")');
await page.waitForURL(/\/app\/rechnungen\/\d+/, { timeout: 15000 });
const invoiceId = Number(page.url().match(/\/rechnungen\/(\d+)/)[1]);
const body = await page.textContent("body");
body?.includes("45,00") ? ok("Entwurf hat die offene Stunde übernommen (45,00 €)") : bad("Stunde nicht übernommen");

// --- Rabattzeile ergänzen (negativer Betrag) ------------------------------
await page.fill("#description", "Treuerabatt");
await page.fill("#unitPrice", "-5,00");
await page.click('button:has-text("Position hinzufügen")');
await page.waitForTimeout(1500);
await page.reload();
const afterDiscount = await page.textContent("body");
afterDiscount?.includes("40,00") ? ok("Rabattzeile wirkt: Summe 40,00 €") : bad("Rabatt nicht verrechnet");

// --- Festschreiben muss ohne Steuernummer scheitern -----------------------
page.on("dialog", (d) => d.accept());
await page.click('button:has-text("Festschreiben")');
await page.waitForTimeout(2000);
const blocked = await page.textContent("body");
blocked?.includes("§ 14 UStG") && blocked?.includes("Steuernummer")
  ? ok("Festschreiben ohne Steuernummer blockiert (§ 14 UStG)")
  : bad("Pflichtangaben nicht geprüft");

// --- Steuernummer nachtragen ----------------------------------------------
await page.goto(`${BASE}/app/einstellungen`);
await page.fill("#taxNumber", "111/2222/3333");
await page.fill("#iban", "DE02120300000000202051");
await page.fill("#bankAccountHolder", "Dominic Zander");
await page.click('button:has-text("Speichern")');
await page.waitForTimeout(1500);
ok("Steuernummer eingetragen");

// --- Jetzt festschreiben ---------------------------------------------------
await page.goto(`${BASE}/app/rechnungen/${invoiceId}`);
await page.click('button:has-text("Festschreiben")');
await page.waitForTimeout(2500);
await page.reload();
const finalized = await page.textContent("h1");
/RE-\d{4}-0001/.test(finalized ?? "")
  ? ok(`Festgeschrieben mit Nummer ${finalized?.trim()}`)
  : bad("Keine Rechnungsnummer vergeben", finalized ?? "");

// --- Unveränderlichkeit ----------------------------------------------------
const stillEditable = await page.locator('button:has-text("Position hinzufügen")').count();
stillEditable === 0 ? ok("Positionen nach dem Festschreiben nicht mehr editierbar") : bad("Rechnung noch editierbar");

await page.goto(`${BASE}/app/stunden/${lessonId}`);
const lessonLocked = await page.textContent("body");
lessonLocked?.includes("unveränderlich")
  ? ok("Abgerechnete Stunde ist gesperrt")
  : bad("Stunde noch änderbar");

// --- Druckansicht ----------------------------------------------------------
await page.goto(`${BASE}/druck/rechnung/${invoiceId}`);
const print = await page.textContent("body");
const checks = [
  ["Rechnungsnummer", /RE-\d{4}-0001/],
  ["Rechnungsdatum", /Rechnungsdatum/],
  ["Leistungszeitraum", /Leistungszeitraum/],
  ["Name des Ausstellers", /Dominic Zander/],
  ["Anschrift des Ausstellers", /Nordsternstr\. 6a/],
  ["Name des Empfängers", /Familie Muster/],
  ["Anschrift des Empfängers", /Musterweg 1/],
  ["Steuernummer", /111\/2222\/3333/],
  ["Leistungsbezeichnung", /Nachhilfeunterricht/],
  ["Leistungsdatum je Position", /14\.09\.2026/],
  ["Steuerhinweis", /§ 4 Nr\. 21/],
  ["Rechnungsbetrag", /40,00/],
  ["Verwendungszweck", /Verwendungszweck/],
];
for (const [label, re] of checks) {
  re.test(print ?? "") ? ok(`Pflichtangabe vorhanden: ${label}`) : bad(`Pflichtangabe fehlt: ${label}`);
}

// --- Storno ---------------------------------------------------------------
await page.goto(`${BASE}/app/rechnungen/${invoiceId}`);
await page.waitForSelector('button:has-text("Stornieren")', { timeout: 20000 });
await page.click('button:has-text("Stornieren")');
await page.waitForTimeout(4000);
const stornoH1 = await page.textContent("h1");
/RE-\d{4}-0002/.test(stornoH1 ?? "")
  ? ok(`Storno erhält die nächste Nummer (${stornoH1?.trim()})`)
  : bad("Storno-Nummer falsch", stornoH1 ?? "");
const stornoBody = await page.textContent("body");
stornoBody?.includes("Stornorechnung") ? ok("Als Stornorechnung gekennzeichnet") : bad("Kennzeichnung fehlt");
stornoBody?.includes("-40,00") ? ok("Storno-Betrag negativ, passend zu den Positionen") : bad("Betrag nicht negiert");

await page.goto(`${BASE}/app/rechnungen/${invoiceId}`);
await page.waitForSelector("h1", { timeout: 20000 });
const origBody = await page.textContent("body");
origBody?.includes("storniert") ? ok("Original als storniert markiert") : bad("Original nicht storniert");
origBody?.includes("RE-2026-0001") ? ok("Original behält seine Nummer") : bad("Originalnummer verloren");

await browser.close();
console.log(failed === 0 ? "\n  Alle Prüfungen bestanden." : `\n  ${failed} Prüfung(en) fehlgeschlagen.`);
process.exitCode = failed === 0 ? 0 : 1;
