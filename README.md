# dominic-zander.de

Website und interner Verwaltungsbereich für die Nachhilfe von Dominic Zander.

Ein Next.js-16-Projekt: die öffentlichen Seiten werden beim Build statisch vorgerendert,
der Verwaltungsbereich unter `/app` läuft serverseitig gegen eine Postgres-Datenbank.

## Aufbau

```
app/(marketing)/   Öffentliche Seiten – Startseite, Impressum, Datenschutz
app/(admin)/app/   Verwaltungsbereich, passwortgeschützt
app/(print)/druck/ Druckansicht der Rechnung, eigenes Layout ohne Navigation
lib/db/            Drizzle-Schema und Datenbankverbindung
lib/actions/       Server Actions je Fachbereich
lib/queries.ts     Leseabfragen; sämtliche Zeitzonenumrechnung passiert hier in SQL
drizzle/           Migrationen
tests/             End-to-End-Prüfungen mit Playwright
```

## Lokal starten

```bash
# Postgres bereitstellen
docker run -d --name nachhilfe-db \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=nachhilfe -p 5432:5432 postgres:16

cp .env.example .env.local     # DATABASE_URL eintragen
npm install
npm run hash-password          # Ergebnis als ADMIN_PASSWORD_HASH in .env.local
npm run db:migrate
npm run db:seed                # Tarife aus der Preisliste
npm run dev
```

Achtung: Node überschreibt bereits gesetzte Umgebungsvariablen nicht. Wenn in der Shell
schon ein `DATABASE_URL` steht, gewinnt dieses gegenüber `.env.local`.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung. TLS wird in Produktion im Code erzwungen, unabhängig davon, ob `?sslmode=require` in der URL steht. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_EMAIL` | Benachrichtigung über neue Kontaktanfragen. Optional – ohne sie wird die Nachricht trotzdem gespeichert. `NOTIFY_EMAIL` hat als Vorgabe die Adresse aus dem Impressum. `RESEND_FROM_EMAIL` muss eine in Resend verifizierte Domain sein. |
| `SITE_URL` | Basis für den Link in der Benachrichtigungsmail. |
| `ADMIN_PASSWORD_HASH` | Erzeugt mit `npm run hash-password`. Format `scrypt:N:r:p:salt:hash`. Die Felder sind mit `:` getrennt, **nicht** mit `$` – dotenv würde `$32768` sonst als Variablenreferenz lesen und den Wert zerstören. |

## Migrationen

```bash
npm run db:generate    # Schema geändert -> Migration erzeugen
npm run db:migrate     # anwenden
```

Migrationen laufen **bewusst nicht** im Netlify-Build: Preview-Deploys würden sonst gegen die
Produktionsdatenbank migrieren, und parallele Builds könnten sich überholen. Das Anwenden ist
ein eigener, bewusster Schritt.

## Tests

```bash
npm run build && npm start     # Terminal 1
npm run test:auth              # Terminal 2 – Anmeldung, Sitzung, Abmelden
npm run test:workflow          #            – Termin -> Stunde -> Rechnung -> Druck -> Storno
npm run test:serien            #            – Serientermine über die Zeitumstellung hinweg
npm run test:guthaben          #            – vorausbezahlte Stunden, keine Doppelberechnung
npm run test:kontakt           #            – Kontaktformular, Posteingang, Spam-Schutz
npm run test:nummernkreise     #            – Rechnungsnummern-Vorlagen und Nummernkreise
```

Die Tests laufen gegen einen echten Server und eine echte Datenbank. `tests/workflow.mjs`
prüft unter anderem, dass eine 90-Minuten-Stunde 45 € kostet und nicht 52,50 € – der Preis
kommt aus der Tariftabelle, nicht aus Dauer × Stundensatz.

**Jede** Datei erwartet eine leere Datenbank und räumt nicht selbst auf; nacheinander in
derselben Datenbank ausgeführt fallen sie durch, weil Kundennummern und Zähler weiterlaufen.
Vor jedem Lauf also zurücksetzen – und dabei **beide** Schemata löschen:

```bash
psql "$DATABASE_URL" -c "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;"
npm run db:migrate && npm run db:seed
```

Das `drizzle`-Schema enthält das Migrationsjournal. Wer nur `public` löscht, bekommt von
`db:migrate` ein zufriedenes „Migrationen angewendet" **ohne eine einzige Tabelle**, weil
drizzle sie laut Journal für längst angewendet hält.

Achtung beim Zurücksetzen: `DATABASE_URL` aus der Umgebung kann auf die Produktionsdatenbank
zeigen und sticht die Datei `.env.local`. Vor einem `drop schema` die Zielhost prüfen.

## Icons

```bash
npm run icons      # erzeugt alles unter public/ neu
```

Quelle ist `scripts/icons/design.mjs` – reine Pfade, keine Bilddateien im Repo-Sinn: eine
Farbänderung ist eine Zeile statt zehn Neuexporte.

Es gibt **drei Zeichnungen, nicht eine skalierte**. Bei 16 px verschwimmen Ringschrift, Atom
und Schriftrolle zu einem Fleck; bei 180 px wäre die Ringschrift elf Pixel hoch und zerfiele
beim Rastern zu einem grauen Saum. Also: `fullSvg` mit Ringschrift ab 256 px, `mediumSvg` ohne
Schrift für 96–192 px, `simpleSvg` mit nur Ring und Monogramm bis 48 px.

Die Ringschrift wird Buchstabe für Buchstabe gesetzt, nicht über `<textPath>` – die
verbreiteten SVG-Rasterizer setzen einfachen Text, Text entlang eines Pfades aber nicht, der
Ring bliebe leer. Die Winkelschritte folgen den Buchstabenbreiten aus `BREITEN`: bei
gleichmäßigen Schritten klebt ein `W` am Nachbarn, während ein `I` allein steht.

`apple-touch-icon.png` ist **PNG, nicht SVG** – iOS unterstützt für Apple-Touch-Icons kein
SVG und zeigte sonst einen leeren Platzhalter. Es ist außerdem vollflächig deckend, weil iOS
transparente Bereiche schwarz hinterlegt.

## Entwurfsentscheidungen, die man kennen sollte

**Termin und Stunde sind dieselbe Datenbankzeile**, unterschieden durch `status`. Zwei
Tabellen hätten einen Zwei-Wege-Abgleich erzwungen; so ist „als gehalten markieren" ein
einziges `UPDATE`.

**Rechnungsnummern kommen aus einer Zählertabelle, nicht aus einem `SEQUENCE`.** `nextval()`
ist absichtlich nicht-transaktional – ein Rollback verbrennt die Nummer dauerhaft und erzeugt
genau die Lücken, die § 14 UStG vermeiden will.

**Der Nummernkreis wird aus der Vorlage abgeleitet, nicht fest verdrahtet.** Eine Vorlage wie
`{INITIALEN}-{KUNDENNR}/{YY}-{MM}{LFD}` ergibt `LM-01/26-0901`; der Zählerschlüssel ist die
gerenderte Vorlage *ohne* die laufende Nummer, hier also `LM-01/26-08`. Damit zählt jede
Schüler:in in jedem Monat für sich – und eine Vorlage ohne `{INITIALEN}` erzeugt automatisch
einen gemeinsamen Kreis, ohne dass am Code etwas geändert werden müsste. Einzelne
Schüler:innen können eine abweichende Vorlage bekommen. Rechtlich verlangt § 14 Abs. 4 Nr. 4
UStG Einmaligkeit, nicht Lückenlosigkeit; getrennte Nummernkreise je Kundschaft sind zulässig.

**Beträge sind Integer in Cent.** Der Postgres-Treiber liefert `numeric` als String zurück,
auch bei `SUM()`.

**Zeitzonen rechnet ausschließlich Postgres.** Weder Browser noch Node fassen ein `Date` an,
wenn es um Termine geht. Das eliminiert die Sommerzeit-Fehlerklasse vollständig. Aus demselben
Grund werden die Termine einer Serie einzeln als lokale Wanduhrzeit erzeugt und nicht durch
Addition von 7×24 Stunden – sonst läge „jeden Dienstag 17:00" nach der Zeitumstellung auf 16:00.

**Serientermine werden materialisiert, nicht errechnet.** Jeder Termin ist eine echte Zeile.
Das ist notwendig, nicht bequem: eine Stunde wird abgerechnet, hängt an einer Rechnungsposition
und wird nach dem Festschreiben von Triggern gesperrt – ein virtuelles Vorkommen könnte davon
nichts. Die Serie bleibt daneben erhalten, damit „verlängern" und „beenden" möglich sind.

**Monatsbereiche rechnet Postgres aus.** Ein zusammengesetztes `YYYY-MM-31` ist in fünf von
zwölf Monaten ein ungültiges Datum.

**Vorausbezahlte Stunden gibt es in zwei Formen**: ein Stundenkontingent (die 5er-Karte:
N Einheiten für eine bestimmte Stundenlänge) und ein reines Geldguthaben, das pro Stunde
abgebucht wird. Guthaben und Preis sind getrennte Felder, damit sich auch „200 € Guthaben
für 180 €" abbilden lässt.

**Das Kontaktformular ist der einzige Schreibzugriff ohne Anmeldung.** Entsprechend:
Honeypot-Feld, Drosselung global und je Absenderadresse, Längenbegrenzung auf allen Feldern.
CSRF deckt Next.js selbst ab, weil Server Actions Origin gegen Host prüfen. Bewusst nicht
gespeichert werden IP-Adresse und User-Agent – für die Drosselung genügt die Anzahl im
Zeitfenster, und nicht erhobene Daten muss man weder schützen noch löschen.

**Die E-Mail-Benachrichtigung ist „best effort".** Eine Kontaktanfrage darf nie daran
scheitern, dass Resend gerade nicht erreichbar ist. Die Nachricht wird zuerst gespeichert,
danach wird benachrichtigt; ein Fehler wird am Eintrag vermerkt und im Posteingang angezeigt,
statt still zu verschwinden.

**„Offen zur Abrechnung" hat genau eine Definition**, `OPEN_FOR_BILLING` in `lib/queries.ts`.
Sie stand vorher an fünf Stellen verteilt; mit dem Guthaben kam eine sechste Bedingung dazu.
Hätte man dabei eine Stelle übersehen, wäre eine bereits vorausbezahlte Stunde ein zweites
Mal berechnet worden.

**Autorisierung liegt im Layout, nicht in der Middleware.** Die Middleware prüft nur, ob
überhaupt ein Cookie da ist. Next.js hatte mit CVE-2025-29927 eine Middleware-Bypass-Lücke;
Autorisierung gehört in die Datenschicht.

**Innerhalb einer Transaktion nie über den Pool abfragen.** Der Pool hält genau eine
Verbindung. Wer in einer Transaktion `db` statt `tx` benutzt, wartet auf eine Verbindung, die
die eigene Transaktion hält – und blockiert damit den gesamten Server.

## Offene Punkte

Siehe [`docs/steuerliche-hinweise.md`](docs/steuerliche-hinweise.md) – insbesondere die Frage,
ob § 4 Nr. 21 UStG tatsächlich greift, und die auf Rechnungen fehlende Steuernummer.
