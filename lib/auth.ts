import "server-only";
import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, lt, sql as raw } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, loginAttempts, sessions } from "./db";

// promisify trifft die Ueberladung mit Optionen nicht, deshalb von Hand.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * Anmeldung fuer genau einen Zugang. Es gibt bewusst keine Benutzertabelle:
 * eine Tabelle mit einer Zeile braucht eine Migration, einen Seeding-Pfad und
 * eine "habe ich das Standardpasswort geaendert?"-Fehlerquelle. Der Hash steht
 * in einer Umgebungsvariablen, Rotation ist "Variable aendern, neu deployen".
 */

const COOKIE_PROD = "__Host-session";
const COOKIE_DEV = "session";
const IDLE_MS = 12 * 60 * 60 * 1000; // 12 Stunden gleitend
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage Obergrenze
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MIN_LOGIN_MS = 200; // konstante Antwortzeit, unabhaengig vom Ergebnis

const isProd = process.env.NODE_ENV === "production";
const cookieName = isProd ? COOKIE_PROD : COOKIE_DEV;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/* ------------------------------------------------------------- Passwort */

/**
 * Prueft das Passwort gegen ADMIN_PASSWORD_HASH im Format
 * scrypt:N:r:p:salt:hash (erzeugt von scripts/hash-password.js).
 *
 * Trennzeichen ist bewusst ":" und nicht "$" wie beim ueblichen PHC-Format:
 * Next.js expandiert .env-Werte im dotenv-Stil, "$32768" wuerde dabei als
 * Variablenreferenz gelesen und verschwinden. Das ist kein theoretisches
 * Risiko - genau daran ist die erste Fassung gescheitert.
 */
async function verifyPassword(password: string): Promise<boolean> {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;

  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64url");
    expected = Buffer.from(parts[5]!, "base64url");
  } catch {
    return false;
  }

  const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  });

  // timingSafeEqual wirft bei unterschiedlicher Laenge, deshalb vorher pruefen.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/* -------------------------------------------------------- Drosselung */

/**
 * Drosselt global auf den einen Zugang, nicht pro IP. Hinter Netlify ist
 * X-Forwarded-For nicht vertrauenswuerdig genug, um eine Sicherheitsentscheidung
 * darauf zu stuetzen. Den einzigen Nutzer voruebergehend auszusperren ist eine
 * hinnehmbare, sich selbst aufloesende Unannehmlichkeit; eine umgehbare
 * IP-Sperre waere dagegen gar keine Massnahme.
 */
export async function isLockedOut(): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();

  const [row] = await db
    .select({
      failures: raw<number>`count(*) filter (where not success)::int`,
      lastFailure: raw<string | null>`max(attempted_at) filter (where not success)`,
      lastSuccess: raw<string | null>`max(attempted_at) filter (where success)`,
    })
    .from(loginAttempts)
    .where(gt(loginAttempts.attemptedAt, since));

  if (!row || row.failures < MAX_FAILURES) return { locked: false, retryAfterSeconds: 0 };

  // Eine erfolgreiche Anmeldung nach den Fehlversuchen hebt die Sperre auf.
  if (row.lastSuccess && row.lastFailure && row.lastSuccess > row.lastFailure) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  const unlockAt = new Date(row.lastFailure!).getTime() + LOCKOUT_WINDOW_MS;
  const retryAfterSeconds = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
  return { locked: true, retryAfterSeconds };
}

async function recordAttempt(success: boolean) {
  await db.insert(loginAttempts).values({ success });
}

/* ----------------------------------------------------------- Sitzungen */

export async function createSession(userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + IDLE_MS);

  await db.insert(sessions).values({
    tokenHash: sha256(token),
    expiresAt: expiresAt.toISOString(),
    userAgent: userAgent?.slice(0, 500) ?? null,
  });

  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
}

/**
 * Die eigentliche Autorisierung. Wird im Layout des Verwaltungsbereichs
 * aufgerufen, NICHT nur in der Middleware: Next.js hatte mit CVE-2025-29927
 * eine Middleware-Bypass-Luecke. Autorisierung gehoert in die Datenschicht.
 */
export async function getSession(): Promise<{ valid: boolean }> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return { valid: false };

  const now = new Date();
  const hash = sha256(token);

  const [row] = await db
    .select({ createdAt: sessions.createdAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, now.toISOString())))
    .limit(1);

  if (!row) return { valid: false };

  // Absolute Obergrenze unabhaengig von der gleitenden Frist.
  if (now.getTime() - new Date(row.createdAt).getTime() > ABSOLUTE_MS) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hash));
    return { valid: false };
  }

  // Gleitende Verlaengerung, aber hoechstens einmal pro Minute schreiben,
  // damit nicht jeder Seitenaufruf eine Schreiboperation ausloest.
  await db
    .update(sessions)
    .set({
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + IDLE_MS).toISOString(),
    })
    .where(
      and(
        eq(sessions.tokenHash, hash),
        lt(sessions.lastSeenAt, new Date(now.getTime() - 60_000).toISOString()),
      ),
    );

  return { valid: true };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) {
    // Serverseitig loeschen, nicht nur das Cookie entfernen.
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  store.delete(cookieName);
}

/* --------------------------------------------------------------- Login */

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSeconds: number }
  | { ok: false; reason: "not_configured" };

export async function login(password: string, userAgent?: string): Promise<LoginResult> {
  const startedAt = Date.now();

  // Konstante Mindestdauer, damit weder Laufzeit noch Fehlertext verraten,
  // woran eine Anmeldung gescheitert ist.
  const settle = async () => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_LOGIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_LOGIN_MS - elapsed));
    }
  };

  if (!process.env.ADMIN_PASSWORD_HASH) {
    await settle();
    return { ok: false, reason: "not_configured" };
  }

  const lock = await isLockedOut();
  if (lock.locked) {
    await settle();
    return { ok: false, reason: "locked", retryAfterSeconds: lock.retryAfterSeconds };
  }

  const valid = await verifyPassword(password);
  await recordAttempt(valid);

  if (!valid) {
    await settle();
    return { ok: false, reason: "invalid" };
  }

  await createSession(userAgent);
  // Abgelaufene Sitzungen bei Gelegenheit aufraeumen – kein Cron noetig.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));

  await settle();
  return { ok: true };
}

/**
 * Absicherung fuer Server Actions.
 *
 * Server Actions sind eigene Endpunkte und werden NICHT vom Layout geschuetzt.
 * Ein Layout-Guard verhindert nur, dass die Seite gerendert wird - eine direkt
 * aufgerufene Action liefe ohne diese Pruefung trotzdem. Deshalb ruft jede
 * mutierende Action requireSession() als erstes auf.
 */
export async function requireSession(): Promise<void> {
  const { valid } = await getSession();
  if (!valid) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
}
