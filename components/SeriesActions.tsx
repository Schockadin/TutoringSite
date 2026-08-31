"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endSeries, extendSeries } from "@/lib/actions/series";
import { date } from "@/lib/format";

/**
 * Verwaltung einer laufenden Terminserie.
 *
 * Bewusst nur zwei Aktionen: verlaengern und beenden. Ein "alle Termine
 * verschieben" waere heikel, weil einzelne Termine bereits gehalten oder
 * abgerechnet sein koennen - diese Faelle muessten dann stillschweigend
 * uebersprungen werden. Einen einzelnen Termin verschiebt man direkt.
 */
export function SeriesActions({
  seriesId,
  untilDate,
  upcoming,
  billed,
}: {
  seriesId: number;
  untilDate: string;
  upcoming: number;
  billed: number;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; kind: "info" | "error" } | null>(null);
  const [newUntil, setNewUntil] = useState("");
  const router = useRouter();

  return (
    <>
      {message && (
        <p className={message.kind === "error" ? "notice notice-error" : "notice notice-info"}>
          {message.text}
        </p>
      )}

      <div className="form-grid">
        <div className="form-row">
          <label htmlFor="newUntil">Serie verlängern bis</label>
          <input
            id="newUntil"
            type="date"
            value={newUntil}
            min={untilDate}
            onChange={(ev) => setNewUntil(ev.target.value)}
          />
          <span className="error-msg" style={{ color: "var(--color-text-muted)" }}>
            Bisher bis {date(untilDate)}
          </span>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || !newUntil}
          onClick={() =>
            start(() =>
              extendSeries(seriesId, newUntil).then((r) => {
                if (r.error) setMessage({ text: r.error, kind: "error" });
                else {
                  setMessage({
                    text:
                      r.added === 1
                        ? "Ein weiterer Termin angelegt."
                        : `${r.added} weitere Termine angelegt.`,
                    kind: "info",
                  });
                  router.refresh();
                }
              }),
            )
          }
        >
          Verlängern
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Serie beenden? Die ${upcoming} noch offenen künftigen Termine werden entfernt. ` +
                  `Bereits gehaltene oder abgerechnete Stunden bleiben erhalten.`,
              )
            )
              return;
            start(() =>
              endSeries(seriesId).then((r) => {
                setMessage({
                  text:
                    `Serie beendet. ${r.removed} künftige Termine entfernt, ` +
                    `${r.kept} Stunden bleiben erhalten.`,
                  kind: "info",
                });
                router.refresh();
              }),
            );
          }}
        >
          Serie beenden
        </button>
      </div>

      {billed > 0 && (
        <p className="hint" style={{ marginTop: "var(--space-3)" }}>
          {billed === 1 ? "Ein Termin dieser Serie ist" : `${billed} Termine dieser Serie sind`}{" "}
          bereits abgerechnet und bleiben in jedem Fall erhalten.
        </p>
      )}
    </>
  );
}
