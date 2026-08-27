import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Eigenes Layout ohne Navigation und ohne Werkzeugleisten: die Druckansicht
 * soll aus einem eigenen Tab heraus direkt druckbar sein, ohne dass das
 * Druck-Stylesheet gegen die Oberflaeche ankaempfen muss.
 *
 * Die Autorisierung wird hier eigenstaendig geprueft - dieses Layout liegt
 * ausserhalb des Verwaltungsbereichs und erbt dessen Schutz nicht.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const { valid } = await getSession();
  if (!valid) redirect("/login");
  return <>{children}</>;
}
