"use client";

import { useEffect } from "react";

/**
 * Setzt den Dokumenttitel, bevor gedruckt wird: Chrome leitet daraus den
 * vorgeschlagenen Dateinamen fuer "Als PDF speichern" ab. Damit heisst die
 * Datei "Rechnung_RE-2026-0001_Mustermann.pdf" statt "rechnung.pdf".
 */
export function PrintButton({ fileName }: { fileName: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = fileName;
    return () => {
      document.title = previous;
    };
  }, [fileName]);

  return (
    <div className="print-bar">
      <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
        Drucken / als PDF sichern
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.close()}>
        Schließen
      </button>
    </div>
  );
}
