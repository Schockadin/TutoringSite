import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Verbindungsaufbau fuer eine serverlose Umgebung.
 *
 * Die App laeuft auf Netlify (AWS Lambda), die Datenbank auf Railway. Railways
 * privates Netz ist damit nicht nutzbar – die Verbindung geht ueber den
 * oeffentlichen Endpunkt und MUSS deshalb TLS verwenden.
 *
 * Jede Lambda-Instanz haelt ihren eigenen Pool, deshalb max: 1. Bei einem
 * Werkzeug fuer genau eine Person reicht das; PgBouncer wird erst noetig, wenn
 * tatsaechlich "too many connections" auftritt.
 */

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Lokal in .env.local eintragen, " +
        "in Produktion in den Netlify-Umgebungsvariablen.",
    );
  }

  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Alle Zeitzonenumrechnungen laufen explizit ueber
    // "at time zone 'Europe/Berlin'" in den Abfragen. Die Verbindung selbst
    // steht auf UTC, damit nichts still von der Container-Zeitzone abhaengt.
    connection: { application_name: "nachhilfe", timezone: "UTC" },
    // Die Zeitstempel werden als Strings gelesen, nie als Date-Objekte:
    // sonst schleicht sich Zeitzonenarithmetik in JavaScript ein.
    transform: { undefined: null },
    onnotice: () => {},
  });
}

// Im Dev-Modus wird das Modul bei jedem Hot Reload neu ausgewertet. Ohne diesen
// globalThis-Cache haeuft sich pro Reload eine weitere Verbindung an.
const client = globalThis.__sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__sql = client;

export const db = drizzle(client, { schema });
export { client as sql };
export * from "./schema";
