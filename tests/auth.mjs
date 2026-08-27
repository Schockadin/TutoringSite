/**
 * End-to-End-Pruefung der Anmeldung gegen einen laufenden Server.
 *
 *   Terminal 1:  npm run build && npm start
 *   Terminal 2:  node tests/auth.mjs
 *
 * Setzt voraus, dass ADMIN_PASSWORD_HASH zum unten stehenden Passwort passt.
 * In dieser Umgebung liegt der Chromium unter /opt/pw-browsers/chromium;
 * PLAYWRIGHT_CHROMIUM ueberschreibt den Pfad.
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.TEST_PASSWORD ?? "TestPasswort2026!";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const ok = (l) => console.log(`  OK    ${l}`);
const bad = (l, extra = "") => {
  console.log(`  FEHLER ${l} ${extra}`);
  process.exitCode = 1;
};

const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
page.url().includes("/login") ? ok("/app leitet auf /login um") : bad("/app ungeschützt", page.url());

await page.fill("#password", "falschesPasswort123");
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);
const err = (await page.textContent(".error-msg"))?.trim() ?? "";
err.includes("falsch") ? ok(`Falsches Passwort abgewiesen ("${err}")`) : bad("Nicht abgewiesen", err);

await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 15000 }).catch(() => {});
page.url().endsWith("/app") ? ok("Anmeldung erfolgreich") : bad("Anmeldung fehlgeschlagen", page.url());

const cookie = (await ctx.cookies()).find((c) => c.name === "session" || c.name === "__Host-session");
if (!cookie) bad("Kein Sitzungs-Cookie");
else {
  cookie.httpOnly ? ok("Cookie ist HttpOnly") : bad("Cookie nicht HttpOnly");
  cookie.sameSite === "Lax" ? ok("Cookie ist SameSite=Lax") : bad("SameSite falsch", cookie.sameSite);
}

const stats = await page.locator(".stat").count();
stats === 4 ? ok(`${stats} Kennzahlen sichtbar`) : bad("Kennzahlen fehlen", String(stats));

await page.click('button:has-text("Abmelden")');
await page.waitForURL("**/login", { timeout: 15000 }).catch(() => {});
page.url().includes("/login") ? ok("Abmelden funktioniert") : bad("Abmelden fehlgeschlagen", page.url());

await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
page.url().includes("/login") ? ok("Sitzung serverseitig beendet") : bad("Sitzung lebt weiter", page.url());

await browser.close();
