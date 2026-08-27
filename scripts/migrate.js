/**
 * Wendet die Migrationen aus drizzle/ an.
 *
 * Bewusst NICHT Teil des Netlify-Builds: Preview-Deploys wuerden sonst gegen
 * die Produktionsdatenbank migrieren, und parallele Builds koennten sich ins
 * Gehege kommen. Migrationen sind ein bewusster Schritt:
 *
 *   npm run db:migrate
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  // Advisory Lock, damit zwei gleichzeitige Laeufe sich nicht ueberholen.
  await client`select pg_advisory_lock(4711)`;
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Migrationen angewendet.");
} catch (err) {
  console.error("Migration fehlgeschlagen:", err.message);
  process.exitCode = 1;
} finally {
  await client`select pg_advisory_unlock(4711)`.catch(() => {});
  await client.end();
}
