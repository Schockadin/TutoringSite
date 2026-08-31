"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Kopfzeile der oeffentlichen Seiten.
 *
 * Auf der Startseite zeigt sie die Sprungmarken-Navigation, auf den
 * Rechtsseiten nur das Logo – genau wie im bisherigen statischen Bestand.
 */
export function SiteHeader({ withNav = false }: { withNav?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href={withNav ? "#top" : "/"} className="logo">
          Dominic Zander<span>Nachhilfe</span>
        </Link>

        {withNav && (
          <>
            <button
              className="nav-toggle"
              aria-label="Menü öffnen"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            <nav className={open ? "main-nav open" : "main-nav"}>
              <ul onClick={() => setOpen(false)}>
                <li>
                  <a href="#ueber-mich">Über mich</a>
                </li>
                <li>
                  <a href="#faecher">Fächer</a>
                </li>
                <li>
                  <a href="#ort-format">Ort</a>
                </li>
                <li>
                  <a href="#preise">Preise</a>
                </li>
                <li>
                  <a href="#kontakt" className="nav-cta">
                    Kontakt
                  </a>
                </li>
              </ul>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
