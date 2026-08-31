"use client";

import { useState, useTransition } from "react";
import { holdLesson } from "@/lib/actions/lessons";

/**
 * Der Ein-Klick-Schritt Termin -> gehaltene Stunde. Damit fliesst die Stunde
 * in die naechste Monatsrechnung ein, ohne sie ein zweites Mal zu erfassen.
 */
export function HoldLessonButton({ id, compact = false }: { id: number; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  return (
    <>
      <button
        type="button"
        className={compact ? "hold-button" : "btn btn-primary btn-sm"}
        disabled={pending}
        title="Als gehalten markieren"
        onClick={() =>
          start(() =>
            holdLesson(id).then((r) => {
              setError(r.error ?? null);
              setRedeemed(r.redeemed ?? false);
            }),
          )
        }
      >
        {pending ? "…" : compact ? "✓" : "Als gehalten markieren"}
      </button>
      {error && <p className="notice notice-error">{error}</p>}
      {redeemed && !compact && (
        <p className="notice notice-info">
          Die Stunde wurde gegen ein vorhandenes Guthaben verrechnet und erscheint deshalb
          nicht in der offenen Abrechnung.
        </p>
      )}
    </>
  );
}
