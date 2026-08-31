/**
 * Gitteraufbau fuer die Monatsansicht.
 *
 * Saemtliche Rechnung laeuft ueber Date.UTC. UTC kennt keine Sommerzeit,
 * "ein Tag weiter" sind dort immer exakt 86.400.000 ms. Mit lokaler Zeit waere
 * genau das an den Umstellungstagen falsch. Verglichen wird ausserdem nur
 * ueber "YYYY-MM-DD"-Strings, nie ueber Date-Objekte.
 */

const DAY_MS = 86_400_000;

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseMonth(value: string | undefined, fallback: string): { year: number; month: number } {
  const source = /^\d{4}-\d{2}$/.test(value ?? "") ? value! : fallback.slice(0, 7);
  const [y, m] = source.split("-").map(Number);
  return { year: y!, month: m! };
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export type CalendarCell = { iso: string; inMonth: boolean; dayOfMonth: number };

/**
 * 6 x 7 Zellen, beginnend am Montag der Woche, in die der Monatserste faellt.
 * Sechs Wochen sind immer genug und halten die Hoehe des Gitters konstant.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = Date.UTC(year, month - 1, 1);
  // getUTCDay: 0 = Sonntag. In Deutschland beginnt die Woche am Montag.
  const weekdayOffset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - weekdayOffset * DAY_MS;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const ms = start + i * DAY_MS;
    const d = new Date(ms);
    cells.push({
      iso: toIso(ms),
      inMonth: d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year,
      dayOfMonth: d.getUTCDate(),
    });
  }
  return cells;
}

/** Erster und letzter Tag des Gitters – als Bereich fuer die Abfrage. */
export function gridRange(cells: CalendarCell[]): { from: string; to: string } {
  return { from: cells[0]!.iso, to: cells[cells.length - 1]!.iso };
}

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Obergrenze fuer Terminserien. Zwei Jahre reichen fuer jede realistische
 * Planung; alles darueber ist eher ein Tippfehler im Enddatum.
 *
 * Liegt bewusst hier und nicht in den Server Actions: eine "use server"-Datei
 * darf ausschliesslich async-Funktionen exportieren.
 */
export const MAX_SERIES_DAYS = 730;
