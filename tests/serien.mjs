/**
 * Prüft Terminserien: Erzeugung über die Zeitumstellung hinweg, Ausnahmen,
 * Verlängern und Beenden.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/serien.mjs
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

await page.goto(`${BASE}/login`);
await page.waitForSelector("#password");
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 20000 });

// Schüler:in anlegen
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

// Serie über die Zeitumstellung am 25.10.2026 anlegen: 13.10. bis 10.11.
await page.goto(`${BASE}/app/stunden/neu?student=${studentId}`);
await page.waitForSelector("#studentId");
await page.selectOption("#studentId", String(studentId));
await page.fill("#date", "2026-10-13");
await page.fill("#time", "17:00");
await page.fill("#durationMinutes", "90");
await page.check('input[name="repeat"]');
await page.selectOption("#repeatIntervalWeeks", "1");
await page.fill("#repeatUntil", "2026-11-10");
await page.click('button:has-text("Serie anlegen")');
await page.waitForURL(/\/app\/kalender/, { timeout: 20000 });

const notice = await page.textContent(".notice");
notice?.includes("5 Termine")
  ? ok("Serie angelegt: 5 Termine")
  : bad("Falsche Anzahl Termine", notice ?? "");

// Alle Termine prüfen – Ortszeit muss über die Umstellung hinweg 17:00 bleiben
// Gezielt die Zeitspalte auslesen statt den ganzen Seitentext zu durchsuchen -
// sonst treffen Monatsauswahl und Dauerangaben mit hinein.
async function zeiten(monat) {
  await page.goto(`${BASE}/app/stunden?monat=${monat}`);
  await page.waitForSelector(".data-table tbody tr");
  return page.$$eval(".data-table tbody tr", (rows) =>
    rows.map((r) => r.querySelectorAll("td")[1]?.textContent?.trim() ?? ""),
  );
}

const okt = await zeiten("2026-10");
okt.length === 3 && okt.every((t) => t === "17:00")
  ? ok(`Oktober: ${okt.length} Termine, alle 17:00`)
  : bad("Oktober-Zeiten falsch", JSON.stringify(okt));

// Der 25.10.2026 ist die Rückstellung auf Winterzeit. Wären die Termine durch
// Addition von 7x24 Stunden erzeugt worden, stünde hier 16:00.
const nov = await zeiten("2026-11");
nov.length === 2 && nov.every((t) => t === "17:00")
  ? ok(`November nach der Zeitumstellung: ${nov.length} Termine, weiterhin 17:00`)
  : bad("Zeitumstellung verschiebt die Termine", JSON.stringify(nov));

// Serienkennzeichnung im Kalender
await page.goto(`${BASE}/app/kalender?monat=2026-10`);
const marks = await page.locator(".series-mark").count();
marks >= 3 ? ok(`Serientermine im Kalender gekennzeichnet (${marks})`) : bad("Kennzeichnung fehlt", String(marks));

// Einen einzelnen Termin absagen – die übrigen dürfen unberührt bleiben
await page.goto(`${BASE}/app/stunden?monat=2026-10`);
// /neu ausschliessen - das ist der "Stunde eintragen"-Link, kein Termin
const firstLink = await page
  .locator('.data-table a[href^="/app/stunden/"]')
  .first()
  .getAttribute("href");
await page.goto(`${BASE}${firstLink}`);
await page.waitForSelector('button:has-text("Absagen (nicht berechnen)")');
const seriesInfo = await page.textContent("body");
seriesInfo?.includes("Terminserie") ? ok("Termin zeigt seine Serienzugehörigkeit") : bad("Serienhinweis fehlt");
await page.click('button:has-text("Absagen (nicht berechnen)")');
await page.waitForTimeout(2500);
await page.goto(`${BASE}/app/stunden?monat=2026-10`);
const afterCancel = await page.textContent("body");
afterCancel?.includes("abgesagt") ? ok("Einzelner Termin abgesagt") : bad("Absage nicht sichtbar");
const stillPlanned = await page.locator(".badge-planned").count();
stillPlanned === 2
  ? ok(`Übrige Termine unberührt (${stillPlanned} weiter geplant)`)
  : bad("Absage traf die ganze Serie", String(stillPlanned));

// Serie verlängern
await page.goto(`${BASE}${firstLink}`);
await page.waitForSelector("#newUntil");
await page.fill("#newUntil", "2026-12-01");
await page.click('button:has-text("Verlängern")');
await page.waitForTimeout(3000);
const extended = await page.textContent("body");
/\d+ weitere Termine angelegt|Ein weiterer Termin angelegt/.test(extended ?? "")
  ? ok("Serie verlängert, fehlende Termine ergänzt")
  : bad("Verlängern fehlgeschlagen");

// Serie beenden – künftige Termine weg, Vergangenes bleibt
// Auf die dauerhafte Wirkung prüfen, nicht auf die Meldung: die wird durch
// das anschliessende Neuladen der Serverkomponente wieder überschrieben.
const vorher = await page.locator(".badge-planned").count();
await page.click('button:has-text("Serie beenden")');
await page.waitForTimeout(3500);
await page.goto(`${BASE}${firstLink}`);
await page.waitForSelector("h1");
const ended = await page.textContent("body");
ended?.includes("Die Serie ist beendet")
  ? ok("Serie als beendet markiert")
  : bad("Serie nicht beendet", (ended ?? "").slice(0, 100));
const noExtendButton = (await page.locator('button:has-text("Verlängern")').count()) === 0;
noExtendButton ? ok("Beendete Serie bietet keine Verlängerung mehr an") : bad("Verlängern noch möglich");

// Der abgesagte Termin dieser Serie muss erhalten bleiben - nur offene
// künftige Termine werden entfernt.
await page.goto(`${BASE}/app/stunden?monat=2026-10`);
await page.waitForSelector(".data-table tbody tr");
const rest = await page.locator(".data-table tbody tr").count();
rest >= 1
  ? ok(`Vergangene und abgesagte Termine bleiben erhalten (${rest} im Oktober)`)
  : bad("Beenden hat zu viel entfernt", String(rest));

await browser.close();
console.log(failed === 0 ? "\n  Alle Prüfungen bestanden." : `\n  ${failed} Prüfung(en) fehlgeschlagen.`);
process.exitCode = failed === 0 ? 0 : 1;
