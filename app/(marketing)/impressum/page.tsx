import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Impressum – Dominic Zander Nachhilfe",
  description: "Impressum und Anbieterkennzeichnung von Dominic Zander Nachhilfe in Essen.",
  alternates: { canonical: "https://dominic-zander.de/impressum" },
  robots: { index: false, follow: true },
};

export default function ImpressumPage() {
  return (
    <>
      <SiteHeader />
      <main className="container legal-page">
        <Link href="/" className="back-link">
          &larr; Zurück zur Startseite
        </Link>
        <h1>Impressum</h1>

        <h2>Angaben gemäß § 5 TMG</h2>
        <p>
          Dominic Zander
          <br />
          Nordsternstr. 6a
          <br />
          45329 Essen
        </p>

        <h2>Kontakt</h2>
        <p>
          Telefon: 0176 401 38 531
          <br />
          E-Mail: dominic.zander@outlook.de
        </p>

        <h2>Umsatzsteuer</h2>
        <p>Umsatzsteuerbefreit gemäß § 4 Nr. 21 UStG.</p>

        <h2>Redaktionell verantwortlich</h2>
        <p>Dominic Zander, Anschrift wie oben</p>
      </main>
    </>
  );
}
