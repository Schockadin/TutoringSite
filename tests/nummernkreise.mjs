/**
 * Prüft die Rechnungsnummern-Vorlagen: eigene Nummernkreise je Schüler:in,
 * Kundennummern, abweichende Vorlagen und die Prüfung der Vorlage selbst.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/nummernkreise.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPasswort2026!";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failed = 0;
const ok = (l) => console.log(`  OK    ${l}`);
const bad = (l, x = "") => { console.log(`  FEHLER ${l} ${x}`); failed++; };

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept());

async function anlegen(vorname, nachname) {
  await page.goto(`${BASE}/app/schueler/neu`);
  await page.waitForSelector("#firstName");
  await page.fill("#firstName", vorname);
  await page.fill("#lastName", nachname);
  await page.fill("#billingName", `Familie ${nachname}`);
  await page.fill("#billingStreet", "Musterweg 1");
  await page.fill("#billingPostalCode", "45329");
  await page.fill("#billingCity", "Essen");
  await page.click('button:has-text("Anlegen")');
  await page.waitForURL(/\/app\/schueler\/\d+$/, { timeout: 20000 });
  return Number(page.url().match(/\/(\d+)$/)[1]);
}

async function rechnungFestschreiben(studentId, datum) {
  await page.goto(`${BASE}/app/stunden/neu?student=${studentId}`);
  await page.waitForSelector("#studentId");
  await page.selectOption("#studentId", String(studentId));
  await page.fill("#date", datum);
  await page.fill("#time", "16:00");
  await page.fill("#durationMinutes", "60");
  await page.click('form button:has-text("Anlegen")');
  await page.waitForURL(/\/app\/stunden\/\d+/, { timeout: 20000 });
  await page.click('button:has-text("Als gehalten markieren")');
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/app/rechnungen/neu?student=${studentId}`);
  await page.waitForSelector("#studentId");
  await page.selectOption("#studentId", String(studentId));
  await page.fill("#periodStart", `${datum.slice(0, 7)}-01`);
  await page.fill("#periodEnd", `${datum.slice(0, 7)}-28`);
  await page.click('button:has-text("Entwurf erstellen")');
  await page.waitForURL(/\/app\/rechnungen\/\d+/, { timeout: 20000 });
  await page.click('button:has-text("Festschreiben")');
  await page.waitForTimeout(3000);
  await page.reload();
  return (await page.textContent("h1"))?.trim() ?? "";
}

await page.goto(`${BASE}/login`);
await page.waitForSelector("#password");
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 20000 });

// Steuernummer, sonst lässt sich nichts festschreiben
await page.goto(`${BASE}/app/einstellungen`);
await page.waitForSelector("#taxNumber");
await page.fill("#taxNumber", "111/2222/3333");
await page.click('button:has-text("Speichern")');
await page.waitForTimeout(2000);

// Vorschau in den Einstellungen
const vorschau = await page.textContent(".template-preview");
vorschau?.includes("LM-01/26-0901")
  ? ok("Einstellungen zeigen eine Beispielnummer zur Vorlage")
  : bad("Vorschau fehlt oder falsch", (vorschau ?? "").trim().slice(0, 50));

// Vorlage ohne {LFD} muss abgelehnt werden
await page.fill("#invoiceNumberTemplate", "RE-{YYYY}");
await page.click('button:has-text("Speichern")');
await page.waitForTimeout(2000);
let body = await page.textContent("body");
body?.includes("{LFD} enthalten")
  ? ok("Vorlage ohne laufende Nummer wird abgelehnt")
  : bad("Ungültige Vorlage akzeptiert");
await page.fill("#invoiceNumberTemplate", "{INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}");
await page.click('button:has-text("Speichern")');
await page.waitForTimeout(2000);

// Zwei Schüler:innen mit GLEICHEN Initialen
const lena = await anlegen("Lena", "Muster");
const lukas = await anlegen("Lukas", "Meier");

await page.goto(`${BASE}/app/schueler/${lena}`);
const kundeA = await page.inputValue("#customerNumber");
await page.goto(`${BASE}/app/schueler/${lukas}`);
const kundeB = await page.inputValue("#customerNumber");
kundeA === "1" && kundeB === "2"
  ? ok(`Kundennummern automatisch vergeben (${kundeA} und ${kundeB})`)
  : bad("Kundennummern falsch", `${kundeA} / ${kundeB}`);

const nrA1 = await rechnungFestschreiben(lena, "2026-08-10");
const nrB1 = await rechnungFestschreiben(lukas, "2026-08-11");

/^LM-01\/\d{2}-\d{2}01$/.test(nrA1) ? ok(`Lena: ${nrA1}`) : bad("Nummer Lena falsch", nrA1);
/^LM-02\/\d{2}-\d{2}01$/.test(nrB1) ? ok(`Lukas: ${nrB1}`) : bad("Nummer Lukas falsch", nrB1);
nrA1 !== nrB1
  ? ok("Gleiche Initialen, aber dank Kundennummer verschiedene Nummern")
  : bad("Nummern kollidieren");
nrA1.endsWith("01") && nrB1.endsWith("01")
  ? ok("Beide starten bei 01 – jede Schüler:in hat einen eigenen Nummernkreis")
  : bad("Kein eigener Nummernkreis");

// Zweite Rechnung für Lena im selben Monat
const nrA2 = await rechnungFestschreiben(lena, "2026-08-20");
/^LM-01\/\d{2}-\d{2}02$/.test(nrA2)
  ? ok(`Zweite Rechnung derselben Schüler:in zählt weiter: ${nrA2}`)
  : bad("Zähler läuft nicht weiter", nrA2);

// Abweichende Vorlage für Lukas
await page.goto(`${BASE}/app/schueler/${lukas}`);
await page.waitForSelector("#invoiceNumberTemplate");
await page.fill("#invoiceNumberTemplate", "SONDER-{NACHNAME}-{YYYY}-{LFD:3}");
await page.click('button:has-text("Speichern")');
await page.waitForTimeout(2500);
const nrB2 = await rechnungFestschreiben(lukas, "2026-08-21");
/^SONDER-MEIER-2026-001$/.test(nrB2)
  ? ok(`Abweichende Vorlage greift: ${nrB2}`)
  : bad("Vorlage je Schüler:in wirkt nicht", nrB2);

await browser.close();
console.log(failed === 0 ? "\n  Alle Prüfungen bestanden." : `\n  ${failed} Prüfung(en) fehlgeschlagen.`);
process.exitCode = failed === 0 ? 0 : 1;
