/**
 * Legt die Tarife aus der oeffentlichen Preisliste an (index.html, Abschnitt
 * "Preise"). Idempotent: vorhandene Tarife bleiben unangetastet.
 *
 * Wichtig: Die Preise sind KEINE Stundensaetze. 60 Minuten kosten 35 €,
 * 90 Minuten aber 45 € und nicht 52,50 €. Abgerechnet wird die Stunde.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

const tariffs = [
  { name: "Einzelstunde 60 Minuten", duration: 60, cents: 3500, sort: 10 },
  { name: "Einzelstunde 90 Minuten", duration: 90, cents: 4500, sort: 20 },
  { name: "5er-Karte 60 Minuten", duration: 60, cents: 3000, sort: 30 },
  { name: "5er-Karte 90 Minuten", duration: 90, cents: 4000, sort: 40 },
  { name: "Ferienkurs 60 Minuten", duration: 60, cents: 2400, sort: 50 },
  { name: "Ferienkurs 90 Minuten", duration: 90, cents: 3000, sort: 60 },
];

try {
  for (const t of tariffs) {
    await sql`
      insert into tariffs (name, duration_minutes, price_cents, sort_order)
      values (${t.name}, ${t.duration}, ${t.cents}, ${t.sort})
      on conflict do nothing
    `;
  }
  // Absenderdaten aus dem Impressum vorbelegen, damit die erste Rechnung nicht
  // an leeren Pflichtfeldern scheitert. Die Steuernummer fehlt im Impressum und
  // muss in den Einstellungen ergaenzt werden.
  await sql`
    update settings set
      issuer_name = coalesce(nullif(issuer_name, ''), 'Dominic Zander'),
      issuer_street = coalesce(nullif(issuer_street, ''), 'Nordsternstr. 6a'),
      issuer_postal_code = coalesce(nullif(issuer_postal_code, ''), '45329'),
      issuer_city = coalesce(nullif(issuer_city, ''), 'Essen'),
      issuer_email = coalesce(nullif(issuer_email, ''), 'dominic.zander@outlook.de'),
      issuer_phone = coalesce(nullif(issuer_phone, ''), '0176 401 38 531')
    where id = 1
  `;
  const [{ count }] = await sql`select count(*)::int as count from tariffs`;
  console.log(`Seed fertig. Tarife in der Datenbank: ${count}`);
} catch (err) {
  console.error("Seed fehlgeschlagen:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
