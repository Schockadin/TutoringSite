# Steuerliche und rechtliche Punkte zum Klären

Dieses Dokument ist **keine Steuer- oder Rechtsberatung**. Es listet auf, was vor der
ersten echten Rechnung mit einer Steuerberatung besprochen werden sollte.

## 1. Greift § 4 Nr. 21 UStG überhaupt?

Das Impressum sagt seit jeher „Umsatzsteuerbefreit gemäß § 4 Nr. 21 UStG". Der
Verwaltungsbereich übernimmt das als Voreinstellung für den Steuerhinweis auf Rechnungen.

**Das ist die wichtigste offene Frage.** § 4 Nr. 21 UStG ist ein echter Befreiungstatbestand
für Bildungsleistungen und setzt für freiberufliche Lehrkräfte in der Regel voraus, dass der
Unterricht *an* einer entsprechend bescheinigten Einrichtung erteilt wird
(§ 4 Nr. 21 Buchst. b UStG), bzw. dass eine **Bescheinigung der zuständigen Landesbehörde**
vorliegt. Privatunterricht bei Schüler:innen zu Hause fällt nicht automatisch darunter.

Diese Aussage steht bereits öffentlich im Impressum – die Frage besteht also unabhängig
von diesem Werkzeug.

## 2. § 19 UStG statt § 4 Nr. 21?

Die Kleinunternehmerregelung ist etwas völlig anderes: sie knüpft an den Umsatz an
(seit 2025: 25.000 € Vorjahr / 100.000 € laufendes Jahr) und nicht an die Art der Leistung.
Falls § 4 Nr. 21 nicht greift, ist § 19 der wahrscheinliche Ersatz – dann müssen sowohl der
Steuerhinweis in den Einstellungen als auch **das Impressum** korrigiert werden.

Beide Varianten sind in den Einstellungen hinterlegt und per Auswahl umschaltbar.

## 3. Steuernummer auf der Rechnung

§ 14 Abs. 4 Nr. 2 UStG verlangt die Steuernummer **oder** die USt-IdNr. auf jeder Rechnung.
Im Impressum steht bislang **keine von beiden**. Ohne diese Angabe verweigert der
Verwaltungsbereich das Festschreiben – bewusst, denn eine Rechnung ohne Pflichtangabe ist
später schwerer zu heilen als eine nicht ausgestellte.

Zu klären: welche der beiden Nummern hier die richtige ist.

## 4. GoBD und Verfahrensdokumentation

Für ein selbstgebautes Abrechnungswerkzeug wird in einer Betriebsprüfung eine
**Verfahrensdokumentation** erwartet: wie Rechnungen entstehen, wie nummeriert wird, wie
gesichert wird. Der technische Teil ist umgesetzt:

- Rechnungsnummern sind lückenlos und werden erst beim Festschreiben vergeben
- festgeschriebene Rechnungen und ihre Positionen sind durch Datenbank-Trigger unveränderlich
- Korrekturen laufen ausschließlich über Stornorechnungen mit eigener Nummer
- abgerechnete Stunden lassen sich nicht mehr ändern oder löschen

Was fehlt, ist die schriftliche Beschreibung dieser Abläufe. Sie ist schnell geschrieben und
gehört in dieselbe Ablage wie die Buchhaltung.

## 5. Aufbewahrungsfristen

Buchungsbelege sind seit dem Vierten Bürokratieentlastungsgesetz **acht Jahre**
aufzubewahren (vorher zehn); für andere Unterlagen können weiterhin zehn Jahre gelten.

Das bestimmt unmittelbar das Löschkonzept: Sobald eine Stunde abgerechnet ist, sticht die
Aufbewahrungspflicht das Löschrecht aus Art. 17 DSGVO (Art. 17 Abs. 3 lit. b). Genau deshalb
lässt sich eine Schüler:in mit Rechnungen nicht löschen, sondern nur archivieren.

**Zu klären:** welche Frist hier konkret gilt.

## 6. Storno-Verfahren

Umgesetzt ist: eine festgeschriebene Rechnung wird nie geändert oder gelöscht, sondern
durch eine Stornorechnung mit eigener fortlaufender Nummer, negierten Positionen und
Verweis auf die Originalnummer aufgehoben.

Zu bestätigen, dass dies dem erwarteten Vorgehen entspricht.

## 7. E-Rechnung

Seit dem 01.01.2025 müssen Unternehmen strukturierte E-Rechnungen **empfangen** können;
die Pflicht zum **Ausstellen** gilt gestaffelt ab 2027/2028 und nur im B2B-Bereich.
Rechnungen an Privatpersonen – also an die Eltern – fallen nicht darunter. Ein PDF aus der
Druckansicht genügt.

Das ist zugleich der Grund, warum in die Druckansicht bewusst nicht mehr Aufwand geflossen
ist: sollte XRechnung/ZUGFeRD später nötig werden, ist das ein eigenes Vorhaben.

## 8. Leistungsdatum

§ 14 Abs. 4 Nr. 6 UStG verlangt den Zeitpunkt der Leistung. Umgesetzt ist **beides**: die
Rechnung nennt den Leistungszeitraum und führt zusätzlich jede Stunde mit ihrem Datum als
eigene Position.

Zu bestätigen, dass das ausreicht.

---

## Datenschutz, separat zu erledigen

Der Verwaltungsbereich verarbeitet Daten von Minderjährigen. Die Datenschutzerklärung der
Website deckt das **nicht** ab – sie richtet sich an Website-Besucher:innen, nicht an
Nachhilfe-Kund:innen. Nötig sind zusätzlich:

- **Art.-13-Hinweise** für Schüler:innen und Eltern bei Vertragsbeginn: was gespeichert wird,
  wozu, wie lange, wer es verarbeitet, welche Rechte bestehen
- **Verzeichnis von Verarbeitungstätigkeiten** nach Art. 30 DSGVO – auch für Einzelunternehmen
- **Auftragsverarbeitungsvertrag** nach Art. 28 DSGVO mit Railway (Datenbank) und Netlify (Hosting)
- **Railway-Projekt in einer EU-Region** anlegen. Das ist die wirksamste einzelne Maßnahme:
  sie hält die Daten der Minderjährigen in der EU.
