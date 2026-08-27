/**
 * Laeuft einmal beim Start der Serverlaufzeit, vor allem uebrigen Code.
 * Setzt die Prozess-Zeitzone hart auf UTC, damit keine Berechnung still von
 * der Zeitzone des Containers abhaengt. Jede Umrechnung nach Europe/Berlin
 * geschieht explizit in SQL und ist damit greppbar.
 */
export async function register() {
  process.env.TZ = "UTC";
}
