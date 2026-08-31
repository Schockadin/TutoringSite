/**
 * Erzeugt den Wert fuer ADMIN_PASSWORD_HASH.
 *
 * Verwendet scrypt aus node:crypto statt argon2 oder bcrypt: beide sind native
 * Module und brechen bei Wechseln des Basis-Images. scrypt ist speicherhart
 * (RFC 7914), in Node enthalten und kostet null Abhaengigkeiten.
 *
 * Die Felder sind mit ":" getrennt, nicht mit "$" wie beim ueblichen
 * PHC-Format. Grund: Next.js expandiert .env-Werte im dotenv-Stil, dabei wuerde
 * "$32768" als Variablenreferenz gelesen und durch einen Leerstring ersetzt.
 * Derselbe Fallstrick lauert in jeder Shell, die den Wert nicht in
 * einfache Anfuehrungszeichen setzt.
 *
 *   npm run hash-password -- "meinPasswort"
 */
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const PARAMS = { N: 32768, r: 8, p: 1 };

async function main() {
  let password = process.argv[2];
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Passwort: ");
    rl.close();
  }
  if (password.length < 12) {
    console.error("\nBitte mindestens 12 Zeichen verwenden.");
    process.exit(1);
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64, {
    ...PARAMS,
    maxmem: 256 * 1024 * 1024,
  });

  const value = [
    "scrypt", PARAMS.N, PARAMS.r, PARAMS.p,
    salt.toString("base64url"), hash.toString("base64url"),
  ].join(":");

  console.log("\nIn die Umgebungsvariablen eintragen:\n");
  console.log(`ADMIN_PASSWORD_HASH=${value}\n`);
}

await main();
