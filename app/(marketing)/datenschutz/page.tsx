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
        <p>
          Über das Kontaktformular dieser Website kannst du eine Anfrage senden. Die dabei
          eingegebenen Daten – Name, E-Mail-Adresse, optional Telefonnummer, Fach und deine
          Nachricht – werden an den Server dieser Website übermittelt und dort in einer Datenbank
          gespeichert, damit ich sie bearbeiten kann.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, da die Verarbeitung der Beantwortung
          deiner Anfrage und der Anbahnung eines möglichen Nachhilfevertrags dient. Sofern deine
          Anfrage nicht auf einen Vertrag zielt, stütze ich die Verarbeitung auf mein berechtigtes
          Interesse an der Beantwortung von Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          Über den Eingang einer neuen Nachricht werde ich zusätzlich per E-Mail benachrichtigt.
          Diese Benachrichtigung enthält die Angaben aus dem Formular und wird über den
          Dienstleister Resend versandt (siehe Abschnitt „Eingesetzte Dienstleister").
        </p>
        <p>
          Ich lösche deine Anfrage, sobald sie erledigt ist und keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen – in der Regel spätestens nach zwölf Monaten. Führt
          deine Anfrage zu einem Nachhilfevertrag, gelten für die daraus entstehenden Unterlagen
          die steuerlichen Aufbewahrungsfristen. Du kannst jederzeit die Löschung verlangen.
        </p>
        <p>
          Die Angabe von Name, E-Mail-Adresse und Nachricht ist erforderlich, um deine Anfrage
          beantworten zu können. Alle weiteren Angaben sind freiwillig. Du kannst mich auch
          formlos per E-Mail oder Telefon erreichen; die Kontaktdaten stehen im Impressum.
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
        <h2>Eingesetzte Dienstleister</h2>
        <p>
          Die Daten des Kontaktformulars und des internen Verwaltungsbereichs werden in einer
          Datenbank bei der Railway Corporation gespeichert. Für den Versand der
          E-Mail-Benachrichtigung über neue Kontaktanfragen setze ich Resend (Plus Five Five, Inc.)
          ein; die Zustellung erfolgt über deren Infrastruktur in der Region Irland (EU). Beide
          Anbieter werden als Auftragsverarbeiter auf Grundlage eines Vertrags nach Art. 28 DSGVO
          tätig. Soweit dabei eine Übermittlung in Drittländer erfolgt, geschieht dies auf
          Grundlage von Standardvertragsklauseln der EU-Kommission.
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
