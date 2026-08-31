import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { countUnread } from "@/lib/actions/contact";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Der Verwaltungsbereich zeigt personenbezogene Daten und darf nie
// vorgerendert oder gecacht werden.
export const dynamic = "force-dynamic";

/**
 * Hier liegt die echte Autorisierung – nicht in der Middleware.
 * Jede Seite unterhalb dieses Layouts ist damit abgesichert, auch wenn
 * jemand die Middleware umgehen sollte.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { valid } = await getSession();
  if (!valid) redirect("/login");

  const unread = await countUnread();

  return (
    <div className="app-shell">
      <AdminNav unread={unread} />
      <main className="app-main container">{children}</main>
    </div>
  );
}
