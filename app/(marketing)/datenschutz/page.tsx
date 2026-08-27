import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Dominic Zander Nachhilfe",
  description:
    "Datenschutzerklärung von Dominic Zander Nachhilfe in Essen – Informationen zur Verarbeitung personenbezogener Daten.",
  alternates: { canonical: "https://dominic-zander.de/datenschutz" },
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  return (
    <>
      <SiteHeader />
      <main className="container legal-page">
        <Link href="/" className="back-link">
          &larr; Zurück zur Startseite
        </Link>
        <h1>Datenschutzerklärung</h1>

        <h2>Verantwortlicher</h2>
        <p>
          Dominic Zander
          <br />
          Nordsternstr. 6a
          <br />
          45329 Essen
          <br />
          E-Mail: dominic.zander@outlook.de
        </p>

        <h2>Kontaktformular</h2>
        {/* Praezisiert auf "ueber dieses Kontaktformular", damit der Satz nicht
            als seitenweite Aussage gelesen werden kann. Inhaltlich unveraendert:
            das Formular sendet weiterhin nichts an einen Server. */}
        <p>
          Diese Website enthält ein Kontaktformular. Die über dieses Kontaktformular eingegebenen
          Daten (Name, E-Mail-Adresse, optional Telefonnummer, Fach und Nachricht) werden nicht an
          einen Server dieser Website übermittelt, sondern über das E-Mail-Programm deines Geräts
          direkt als E-Mail an dominic.zander@outlook.de versendet. Es findet keine Speicherung der
          Formulardaten auf dieser Website statt.
        </p>

        <h2>Geschützter interner Bereich</h2>
        <p>
          Diese Website enthält unter <code>/app</code> einen passwortgeschützten Bereich, den
          ausschließlich der Betreiber zur Verwaltung des Nachhilfeunterrichts nutzt. Daten von
          Besucher:innen dieser Website werden dort nicht verarbeitet. Beim Anmelden wird ein
          technisch notwendiges Sitzungs-Cookie gesetzt, das ausschließlich der Aufrechterhaltung
          der Anmeldung dient und nach dem Abmelden bzw. nach Ablauf der Sitzung ungültig wird.
          Eine Einwilligung ist hierfür nach § 25 Abs. 2 TDDDG nicht erforderlich. Es findet kein
          Tracking und keine Analyse des Nutzungsverhaltens statt.
        </p>

        <h2>Hosting</h2>
        <p>
          Diese Website wird bei Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, CA
          94104, USA gehostet. Beim Aufruf der Website erhebt Netlify automatisch technische
          Zugriffsdaten (Server-Logfiles), z. B. IP-Adresse, Datum und Uhrzeit des Zugriffs,
          aufgerufene Datei, Browsertyp und -version sowie das verwendete Betriebssystem. Diese
          Daten sind technisch erforderlich, um die Website auszuliefern. Die Übermittlung in die
          USA erfolgt auf Grundlage von Standardvertragsklauseln der EU-Kommission. Weitere
          Informationen findest du in der Datenschutzerklärung von Netlify:{" "}
          <a href="https://www.netlify.com/privacy/policy/" target="_blank" rel="noopener">
            netlify.com/privacy/policy
          </a>
          .
        </p>
        <p>
          Die Daten des internen Verwaltungsbereichs werden in einer Datenbank bei Railway
          Corporation gespeichert, die als Auftragsverarbeiter auf Grundlage eines Vertrags nach
          Art. 28 DSGVO tätig wird.
        </p>

        <h2>Deine Rechte</h2>
        <p>
          Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung oder Einschränkung der
          Verarbeitung deiner personenbezogenen Daten sowie ein Beschwerderecht bei der zuständigen
          Aufsichtsbehörde. Wende dich hierfür an die oben genannte Kontaktadresse.
        </p>

        <p>
          <em>
            Hinweis: Dies ist ein Platzhaltertext und ersetzt keine Rechtsberatung. Bitte prüfe die
            Angaben (ggf. mit einem Anwalt oder Datenschutzgenerator) und passe sie an, bevor du die
            Seite veröffentlichst.
          </em>
        </p>
      </main>
    </>
  );
}
