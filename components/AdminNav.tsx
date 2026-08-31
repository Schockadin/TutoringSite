"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/actions/auth";

const LINKS = [
  { href: "/app", label: "Übersicht" },
  { href: "/app/schueler", label: "Schüler:innen" },
  { href: "/app/kalender", label: "Kalender" },
  { href: "/app/stunden", label: "Stunden" },
  { href: "/app/nachrichten", label: "Nachrichten" },
  { href: "/app/rechnungen", label: "Rechnungen" },
  { href: "/app/einstellungen", label: "Einstellungen" },
];

export function AdminNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="app-nav">
      <div className="container app-nav-inner">
        <Link href="/app" className="logo">
          Verwaltung<span>Nachhilfe</span>
        </Link>

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

        <nav className={open ? "app-nav-links open" : "app-nav-links"}>
          <ul onClick={() => setOpen(false)}>
            {LINKS.map((link) => {
              const active =
                link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link href={link.href} className={active ? "active" : undefined}>
                    {link.label}
                    {link.href === "/app/nachrichten" && unread > 0 && (
                      <span className="nav-badge" aria-label={`${unread} ungelesen`}>
                        {unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li>
              <form action={logoutAction}>
                <button type="submit" className="link-button">
                  Abmelden
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
