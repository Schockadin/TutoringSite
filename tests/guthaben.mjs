/**
 * Prüft vorausbezahlte Stunden: Kontingente, Geldguthaben, automatische
 * Verrechnung, Restanzeige und - am wichtigsten - dass eine vorausbezahlte
 * Stunde nicht ein zweites Mal in Rechnung gestellt wird.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/guthaben.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPasswort2026!";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failed = 0;
const ok = (l) => console.log(`  OK    ${l}`);
const bad = (l, x = "") => { console.log(`  FEHLER ${l} ${x}`); failed++; };

/** Intl setzt ein geschütztes Leerzeichen vor das €-Zeichen. */
const norm = (s) => (s ?? "").replace(/[\u00a0\u202f]/g, " ");

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept());

async function neueStunde(studentId, datum, minuten) {
  await page.goto(`${BASE}/app/stunden/neu?student=${studentId}`);
  await page.waitForSelector("#studentId");
  await page.selectOption("#studentId", String(studentId));
  await page.fill("#date", datum);
  await page.fill("#time", "16:00");
  await page.fill("#durationMinutes", String(minuten));
  await page.click('form button:has-text("Anlegen")');
  await page.waitForURL(/\/app\/stunden\/\d+/, { timeout: 20000 });
  return Number(page.url().match(/\/stunden\/(\d+)/)[1]);
}

await page.goto(`${BASE}/login`);
await page.waitForSelector("#password");
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 20000 });

// Schüler:in
await page.goto(`${BASE}/app/schueler/neu`);
await page.fill("#firstName", "Lena");
await page.fill("#lastName", "Muster");
await page.fill("#billingName", "Familie Muster");
await page.fill("#billingStreet", "Musterweg 1");
await page.fill("#billingPostalCode", "45329");
await page.fill("#billingCity", "Essen");
await page.click('button:has-text("Anlegen")');
await page.waitForURL(/\/app\/schueler\/\d+$/, { timeout: 20000 });
const studentId = Number(page.url().match(/\/(\d+)$/)[1]);

// --- 5er-Karte anlegen (Stundenkontingent) ------------------------------
await page.selectOption("#kind", "units");
await page.fill("#label", "5er-Karte 60 Minuten");
await page.fill("#totalUnits", "5");
await page.fill("#unitDurationMinutes", "60");
await page.fill("#priceCents", "150,00");
await page.click('button:has-text("Guthaben anlegen")');
await page.waitForTimeout(2500);
await page.reload();
let body = await page.textContent("body");
body?.includes("5 von 5 übrig") ? ok("5er-Karte angelegt: 5 von 5 übrig") : bad("Guthaben nicht angelegt");

// --- 60-Minuten-Stunde: muss automatisch verrechnet werden ---------------
const l60 = await neueStunde(studentId, "2026-09-15", 60);
await page.click('button:has-text("Als gehalten markieren")');
await page.waitForTimeout(2500);
await page.reload();
body = await page.textContent("body");
norm(body).includes("5er-Karte 60 Minuten") && norm(body).includes("nicht in der offenen Abrechnung")
  ? ok("60-Minuten-Stunde automatisch gegen die 5er-Karte verrechnet")
  : bad("Keine automatische Verrechnung");

await page.goto(`${BASE}/app/schueler/${studentId}`);
body = await page.textContent("body");
body?.includes("4 von 5 übrig") ? ok("Rest korrekt: 4 von 5 übrig") : bad("Restanzeige falsch");

// --- 90-Minuten-Stunde: passt NICHT zum Kontingent ----------------------
const l90 = await neueStunde(studentId, "2026-09-16", 90);
await page.click('button:has-text("Als gehalten markieren")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/app/stunden?filter=offen`);
await page.waitForSelector(".data-table tbody tr", { timeout: 20000 });
const offen = await page.locator(".data-table tbody tr").count();
offen === 1
  ? ok("90-Minuten-Stunde bleibt offen – Kontingent gilt nur für 60 Minuten")
  : bad("Falsche Anzahl offener Stunden", String(offen));

// --- Geldguthaben anlegen: deckt auch die 90 Minuten --------------------
await page.goto(`${BASE}/app/schueler/${studentId}`);
await page.selectOption("#kind", "amount");
await page.fill("#label", "Vorauszahlung");
await page.fill("#creditCents", "100,00");
await page.fill("#priceCents", "100,00");
await page.click('button:has-text("Guthaben anlegen")');
await page.waitForTimeout(2500);

await page.goto(`${BASE}/app/stunden/${l90}`);
await page.waitForSelector('button:has-text("Gegen Guthaben verrechnen")');
await page.click('button:has-text("Gegen Guthaben verrechnen")');
await page.waitForTimeout(2500);
await page.reload();
body = await page.textContent("body");
body?.includes("Vorauszahlung") ? ok("90-Minuten-Stunde gegen Geldguthaben verrechnet") : bad("Verrechnung fehlgeschlagen");

await page.goto(`${BASE}/app/schueler/${studentId}`);
body = await page.textContent("body");
norm(body).includes("55,00 € von 100,00 € übrig")
  ? ok("Geldguthaben korrekt reduziert: 55,00 € von 100,00 € übrig")
  : bad("Guthabenrest falsch");

// --- Kernpunkt: keine Doppelberechnung ----------------------------------
await page.goto(`${BASE}/app/stunden?filter=offen`);
const nochOffen = await page.locator(".data-table tbody tr").count();
nochOffen === 0 ? ok("Keine offenen Stunden mehr – beide sind vorausbezahlt") : bad("Stunden weiterhin offen", String(nochOffen));

await page.goto(`${BASE}/app/rechnungen/neu?student=${studentId}`);
await page.waitForSelector("#studentId");
await page.selectOption("#studentId", String(studentId));
await page.fill("#periodStart", "2026-09-01");
await page.fill("#periodEnd", "2026-09-30");
await page.click('button:has-text("Entwurf erstellen")');
await page.waitForURL(/\/app\/rechnungen\/\d+/, { timeout: 20000 });
const rows = await page.locator(".data-table tbody tr").count();
body = await page.textContent("body");
const hatStunden = /Nachhilfeunterricht/.test(body ?? "");
!hatStunden
  ? ok("Rechnung enthält KEINE der vorausbezahlten Stunden")
  : bad("Vorausbezahlte Stunde würde doppelt berechnet");

// Die Guthaben selbst gehören dagegen auf die Rechnung
norm(body).includes("5er-Karte") && norm(body).includes("Vorauszahlung")
  ? ok("Die beiden Guthaben stehen als Positionen auf der Rechnung")
  : bad("Guthaben fehlen auf der Rechnung", String(rows));
norm(body).includes("250,00")
  ? ok("Summe 250,00 € (150 € Karte + 100 € Vorauszahlung)")
  : bad("Summe falsch");

// --- Verrechnung aufheben macht die Stunde wieder abrechenbar -----------
await page.goto(`${BASE}/app/stunden/${l60}`);
await page.waitForSelector('button:has-text("Verrechnung aufheben")');
await page.click('button:has-text("Verrechnung aufheben")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/app/stunden?filter=offen`);
await page.waitForSelector(".data-table tbody tr", { timeout: 20000 });
const wiederOffen = await page.locator(".data-table tbody tr").count();
wiederOffen === 1 ? ok("Aufgehobene Verrechnung macht die Stunde wieder abrechenbar") : bad("Stunde nicht zurück", String(wiederOffen));

await page.goto(`${BASE}/app/schueler/${studentId}`);
body = await page.textContent("body");
body?.includes("5 von 5 übrig") ? ok("Guthaben wieder bei 5 von 5") : bad("Guthaben nicht zurückgebucht");

// --- Übersicht zeigt das Restguthaben -----------------------------------
await page.goto(`${BASE}/app`);
body = await page.textContent("body");
body?.includes("Vorausbezahlt und noch offen")
  ? ok("Übersicht weist das offene Guthaben aus")
  : bad("Übersicht ohne Guthabenhinweis");

await browser.close();
console.log(failed === 0 ? "\n  Alle Prüfungen bestanden." : `\n  ${failed} Prüfung(en) fehlgeschlagen.`);
process.exitCode = failed === 0 ? 0 : 1;
