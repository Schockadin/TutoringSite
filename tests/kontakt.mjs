/**
 * Prüft das Kontaktformular: Speicherung statt mailto, Posteingang,
 * Spam-Schutz und das Verhalten, wenn die Benachrichtigung scheitert.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/kontakt.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPasswort2026!";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failed = 0;
const ok = (l) => console.log(`  OK    ${l}`);
const bad = (l, x = "") => { console.log(`  FEHLER ${l} ${x}`); failed++; };

const browser = await chromium.launch({ executablePath });

// --- Öffentliche Seite: als anonyme Besucher:in ---------------------------
const gast = await browser.newContext();
const page = await gast.newPage();

async function absenden({ name, email, nachricht, honeypot }) {
  // Eindeutige Abfrage erzwingt eine echte Navigation: ein reiner
  // Hash-Wechsel lädt die Seite nicht neu, und nach dem Absenden ist das
  // Formular durch die Erfolgsmeldung ersetzt.
  await page.goto(`${BASE}/?t=${Date.now()}#kontakt`);
  await page.waitForSelector("#name");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#message", nachricht);
  if (honeypot) await page.fill("#website", honeypot);
  await page.click('button:has-text("Nachricht senden")');
  await page.waitForTimeout(2500);
  return (await page.textContent(".form-note")) ?? "";
}

// Kein mailto mehr
await page.goto(`${BASE}/#kontakt`);
await page.waitForSelector("#name");
const formAction = await page.getAttribute("form", "action");
const mailtoLinks = await page.locator('form a[href^="mailto:"]').count();
mailtoLinks === 0 ? ok("Formular öffnet kein E-Mail-Programm mehr") : bad("mailto noch vorhanden");

// Pflichtfelder
await page.click('button:has-text("Nachricht senden")');
await page.waitForTimeout(2000);
let fehler = await page.locator(".error-msg").allTextContents();
fehler.filter(Boolean).length >= 2
  ? ok("Pflichtfelder werden serverseitig geprüft")
  : bad("Keine Validierung", JSON.stringify(fehler));

// Erfolgreiche Absendung
let note = await absenden({
  name: "Familie Muster",
  email: "muster@example.org",
  nachricht: "Hallo, wir suchen Nachhilfe in Mathe für die 9. Klasse.",
});
note.includes("Danke") ? ok(`Nachricht gesendet („${note.trim().slice(0, 40)}…")`) : bad("Kein Erfolg", note);

// Honeypot: Bot wird abgewiesen, merkt es aber nicht
note = await absenden({
  name: "Bot",
  email: "bot@example.org",
  nachricht: "Billige Uhren",
  honeypot: "http://spam.example",
});
note.includes("Danke") ? ok("Honeypot antwortet unauffällig mit Erfolg") : bad("Honeypot verrät sich", note);

// Drosselung je Adresse: nach drei Nachrichten ist Schluss
for (let i = 2; i <= 3; i++) {
  await absenden({ name: "Familie Muster", email: "muster@example.org", nachricht: `Nachfrage ${i}` });
}
note = await absenden({ name: "Familie Muster", email: "muster@example.org", nachricht: "Und noch eine" });
note.includes("mehrere Nachrichten eingegangen")
  ? ok("Drosselung greift ab der vierten Nachricht derselben Adresse")
  : bad("Drosselung greift nicht", note.trim().slice(0, 60));

await gast.close();

// --- Verwaltungsbereich ---------------------------------------------------
const admin = await browser.newContext();
const app = await admin.newPage();
app.on("dialog", (d) => d.accept());

await app.goto(`${BASE}/login`);
await app.waitForSelector("#password");
await app.fill("#password", PASSWORD);
await app.click('button[type="submit"]');
await app.waitForURL("**/app", { timeout: 20000 });

let body = await app.textContent("body");
body?.includes("neue Nachrichten") || body?.includes("Eine neue Nachricht")
  ? ok("Übersicht weist auf neue Nachrichten hin")
  : bad("Kein Hinweis auf der Übersicht");
const badge = await app.locator(".nav-badge").count();
badge === 1 ? ok("Navigation zeigt einen Zähler für Ungelesenes") : bad("Kein Zähler", String(badge));

await app.goto(`${BASE}/app/nachrichten`);
await app.waitForSelector(".data-table tbody tr");
const zeilen = await app.locator(".data-table tbody tr").count();
zeilen === 3
  ? ok(`Posteingang enthält 3 Nachrichten – die Bot-Nachricht wurde nicht gespeichert`)
  : bad("Falsche Anzahl im Posteingang", String(zeilen));

body = await app.textContent("body");
body?.includes("Billige Uhren") ? bad("Bot-Nachricht wurde gespeichert") : ok("Bot-Nachricht nicht gespeichert");

// Ohne Resend-Schlüssel muss der Zustellfehler sichtbar sein
body?.includes("Mail nicht zugestellt")
  ? ok("Fehlgeschlagene Benachrichtigung wird im Posteingang angezeigt")
  : bad("Zustellfehler bleibt unsichtbar");

// Öffnen markiert als gelesen
// Auf die URL warten, nicht auf "h1" - die Listenseite hat selbst eine,
// sodass der Selektor sofort auf der alten Seite auflöst.
await app.locator('.data-table tbody a[href^="/app/nachrichten/"]').first().click();
await app.waitForURL(/\/app\/nachrichten\/\d+$/, { timeout: 20000 });
await app.waitForSelector(".form-section");
body = await app.textContent("body");
body?.includes("Familie Muster") && body?.includes("Nachhilfe in Mathe")
  ? ok("Nachricht wird vollständig angezeigt")
  : bad("Nachricht unvollständig");
body?.includes("konnte nicht zugestellt werden")
  ? ok("Detailseite erklärt den Zustellfehler")
  : bad("Kein Hinweis auf der Detailseite");

await app.goto(`${BASE}/app/nachrichten`);
const nochNeu = await app.locator(".badge-open").count();
nochNeu === 2 ? ok("Geöffnete Nachricht gilt als gelesen") : bad("Lesestatus falsch", String(nochNeu));

// Archivieren
await app.locator('.data-table tbody a[href^="/app/nachrichten/"]').first().click();
await app.waitForURL(/\/app\/nachrichten\/\d+$/, { timeout: 20000 });
await app.waitForSelector('button:has-text("Archivieren")');
await app.click('button:has-text("Archivieren")');
await app.waitForTimeout(2500);
await app.goto(`${BASE}/app/nachrichten`);
const nachArchiv = await app.locator(".data-table tbody tr").count();
nachArchiv === 2 ? ok("Archivierte Nachricht verschwindet aus dem Posteingang") : bad("Archivieren wirkt nicht", String(nachArchiv));
await app.goto(`${BASE}/app/nachrichten?archiv=1`);
const mitArchiv = await app.locator(".data-table tbody tr").count();
mitArchiv === 3 ? ok("Archiv-Ansicht zeigt sie weiterhin") : bad("Archiv unvollständig", String(mitArchiv));

await browser.close();
console.log(failed === 0 ? "\n  Alle Prüfungen bestanden." : `\n  ${failed} Prüfung(en) fehlgeschlagen.`);
process.exitCode = failed === 0 ? 0 : 1;
