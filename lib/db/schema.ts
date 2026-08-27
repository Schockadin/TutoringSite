import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Bezeichner und Statuswerte sind durchgehend englisch – Deutsch erscheint
 * ausschliesslich im UI ueber die Label-Maps in lib/format.ts.
 *
 * Statuswerte sind text + CHECK statt Postgres-ENUM: einen Wert zu ergaenzen
 * ist damit eine Zeile Migration statt eines ALTER-TYPE-Tanzes.
 *
 * Geldbetraege sind durchgehend integer in Cent, niemals numeric. Der Treiber
 * liefert numeric als String zurueck (auch bei SUM()), Cent-Integer mappen
 * dagegen exakt auf JS-number. Jedes Feld traegt den Suffix _cents, damit ein
 * Einheitenfehler an der Aufrufstelle sichtbar wird.
 */

const bytea = customType<{ data: Buffer; notNull: true }>({
  dataType: () => "bytea",
});

const tstz = { withTimezone: true, mode: "string" } as const;

/* ---------------------------------------------------------------- Settings */

/**
 * Genau eine Zeile. Eine typisierte Tabelle schlaegt hier einen JSONB-Blob:
 * die Felder sind wenige, fest, und jedes einzelne ist eine Pflichtangabe
 * nach § 14 Abs. 4 UStG, die einen Namen und eine Bedingung verdient.
 */
export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),

    // Leistender Unternehmer (§ 14 Abs. 4 Nr. 1 UStG)
    issuerName: text("issuer_name").notNull().default(""),
    issuerStreet: text("issuer_street").notNull().default(""),
    issuerPostalCode: text("issuer_postal_code").notNull().default(""),
    issuerCity: text("issuer_city").notNull().default(""),
    issuerCountry: text("issuer_country").notNull().default("DE"),
    issuerEmail: text("issuer_email").notNull().default(""),
    issuerPhone: text("issuer_phone").notNull().default(""),

    // Steuernummer oder USt-IdNr. (§ 14 Abs. 4 Nr. 2 UStG) – mindestens eines Pflicht
    taxNumber: text("tax_number").notNull().default(""),
    vatId: text("vat_id").notNull().default(""),

    // Steuerregime. Voreinstellung ist § 4 Nr. 21 UStG, weil genau das im
    // Impressum steht – NICHT die Kleinunternehmerregelung nach § 19.
    taxMode: text("tax_mode").notNull().default("exempt_4_21"),
    taxRateBp: integer("tax_rate_bp").notNull().default(0), // Basispunkte: 1900 = 19 %
    taxNote: text("tax_note")
      .notNull()
      .default("Umsatzsteuerbefreit gemäß § 4 Nr. 21 Buchst. b UStG."),

    // Zahlungsdaten
    bankAccountHolder: text("bank_account_holder").notNull().default(""),
    iban: text("iban").notNull().default(""),
    bic: text("bic").notNull().default(""),
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),

    // Rechnungsformat
    invoiceNumberPrefix: text("invoice_number_prefix").notNull().default("RE"),
    invoiceIntroText: text("invoice_intro_text").notNull().default(""),
    invoiceFooterNote: text("invoice_footer_note").notNull().default(""),

    defaultDurationMinutes: integer("default_duration_minutes").notNull().default(60),

    updatedAt: timestamp("updated_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_tax_mode", sql`${t.taxMode} in ('exempt_4_21','small_business_19','standard')`),
    check("settings_tax_rate", sql`${t.taxRateBp} between 0 and 10000`),
    check("settings_terms", sql`${t.paymentTermsDays} between 0 and 365`),
    check("settings_duration", sql`${t.defaultDurationMinutes} between 1 and 600`),
  ],
);

/* ----------------------------------------------------------------- Tariffs */

/**
 * Das Preisprimitiv. Bewusst NICHT "Stundensatz": laut Preisliste kostet eine
 * 60-Minuten-Stunde 35 €, eine 90-Minuten-Stunde aber 45 € und nicht 52,50 €.
 * Abgerechnet wird die Stunde, nicht die Zeiteinheit.
 */
export const tariffs = pgTable(
  "tariffs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tariffs_name_key").on(sql`lower(btrim(${t.name}))`),
    check("tariffs_name_len", sql`length(btrim(${t.name})) between 1 and 100`),
    check("tariffs_duration", sql`${t.durationMinutes} between 1 and 600`),
    check("tariffs_price", sql`${t.priceCents} >= 0`),
  ],
);

/* ---------------------------------------------------------------- Students */

export const students = pgTable(
  "students",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    grade: text("grade"),
    school: text("school"),
    subjects: text("subjects").array().notNull().default(sql`'{}'`),
    studentEmail: text("student_email"),
    studentPhone: text("student_phone"),

    // Rechnungsempfaenger sind in der Regel die Eltern, nicht das Kind.
    // Minderjaehrige sind ueblicherweise nicht Vertragspartner – deshalb ein
    // eigener Block statt einer Wiederverwendung der Schuelerdaten.
    billingName: text("billing_name"),
    billingEmail: text("billing_email"),
    billingPhone: text("billing_phone"),
    billingStreet: text("billing_street"),
    billingPostalCode: text("billing_postal_code"),
    billingCity: text("billing_city"),
    billingCountry: text("billing_country").notNull().default("DE"),

    defaultTariffId: integer("default_tariff_id").references(() => tariffs.id, {
      onDelete: "set null",
    }),
    // Rueckfallebene fuer krumme Dauern, fuer die kein Tarif hinterlegt ist
    hourlyRateCents: integer("hourly_rate_cents"),

    notes: text("notes"),
    archivedAt: timestamp("archived_at", tstz),
    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    index("students_name_idx").on(sql`lower(${t.lastName})`, sql`lower(${t.firstName})`),
    index("students_tariff_idx").on(t.defaultTariffId),
    check("students_first_name", sql`length(btrim(${t.firstName})) between 1 and 100`),
    check("students_last_name", sql`length(btrim(${t.lastName})) between 1 and 100`),
    check("students_hourly_rate", sql`${t.hourlyRateCents} is null or ${t.hourlyRateCents} >= 0`),
  ],
);

/* ----------------------------------------------------------------- Lessons */

/**
 * Termin und Stunde sind DIESELBE Zeile, unterschieden durch status.
 *
 * Zwei getrennte Tabellen wuerden einen Zwei-Wege-Abgleich erzwingen (Termin
 * verschieben – wandert die Stunde mit?), einen Join fuer den Kalender kosten
 * und eine zusaetzliche Zustandslogik gegen "ein Termin erzeugt zwei Stunden"
 * verlangen. So ist der Ein-Klick-Workflow schlicht ein UPDATE des Status.
 *
 * status='planned' ist im UI ein Termin, status='held' eine Stunde.
 */
export const lessons = pgTable(
  "lessons",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    studentId: integer("student_id")
      .notNull()
      // RESTRICT, nicht CASCADE: Abrechnungshistorie darf nie still verschwinden.
      .references(() => students.id, { onDelete: "restrict" }),

    startsAt: timestamp("starts_at", tstz).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),

    status: text("status").notNull().default("planned"),

    subject: text("subject"),
    location: text("location"),
    topic: text("topic"),
    notes: text("notes"),

    tariffId: integer("tariff_id").references(() => tariffs.id, { onDelete: "set null" }),
    priceCents: integer("price_cents"),
    // Bewusst getrennt vom Status: ein no_show ist oft trotzdem abrechenbar,
    // eine gehaltene Probestunde dagegen nicht.
    billable: boolean("billable").notNull().default(true),

    cancelledAt: timestamp("cancelled_at", tstz),
    cancellationReason: text("cancellation_reason"),

    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    index("lessons_starts_idx").on(t.startsAt),
    index("lessons_student_starts_idx").on(t.studentId, t.startsAt.desc()),
    index("lessons_tariff_idx").on(t.tariffId),
    check("lessons_duration", sql`${t.durationMinutes} between 1 and 600`),
    check("lessons_status", sql`${t.status} in ('planned','held','cancelled','no_show')`),
    check("lessons_price", sql`${t.priceCents} is null or ${t.priceCents} >= 0`),
    check(
      "lessons_price_required",
      sql`${t.status} not in ('held','no_show') or not ${t.billable} or ${t.priceCents} is not null`,
    ),
    check(
      "lessons_cancel_fields",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
  ],
);

/* ---------------------------------------------------------------- Invoices */

/**
 * Jedes Feld, das der Ausdruck zeigt, wird beim Festschreiben auf die Rechnung
 * kopiert. Wuerde der Druck die Absenderdaten live aus settings lesen, wuerde
 * ein Adresswechsel die Historie umschreiben – fachlich falsch und ein
 * GoBD-Problem.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),

    status: text("status").notNull().default("draft"),

    // Fortlaufende Nummer (§ 14 Abs. 4 Nr. 4 UStG) – NULL solange Entwurf
    number: text("number").unique(),
    numberYear: integer("number_year"),
    numberSeq: integer("number_seq"),

    issueDate: date("issue_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    servicePeriodStart: date("service_period_start", { mode: "string" }),
    servicePeriodEnd: date("service_period_end", { mode: "string" }),

    // Snapshots Leistender
    issuerName: text("issuer_name"),
    issuerAddress: text("issuer_address"),
    issuerEmail: text("issuer_email"),
    issuerPhone: text("issuer_phone"),
    issuerTaxNumber: text("issuer_tax_number"),
    issuerVatId: text("issuer_vat_id"),
    issuerAccountHolder: text("issuer_account_holder"),
    issuerIban: text("issuer_iban"),
    issuerBic: text("issuer_bic"),

    // Snapshots Leistungsempfaenger
    recipientName: text("recipient_name"),
    recipientAddress: text("recipient_address"),

    // Snapshots Steuer – ein spaeterer Regimewechsel darf alte Rechnungen nicht veraendern
    taxMode: text("tax_mode"),
    taxRateBp: integer("tax_rate_bp"),
    taxNote: text("tax_note"),

    netCents: integer("net_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),

    introText: text("intro_text"),
    footerNote: text("footer_note"),

    paidOn: date("paid_on", { mode: "string" }),
    cancelledAt: timestamp("cancelled_at", tstz),
    cancelsInvoiceId: integer("cancels_invoice_id"),

    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_student_idx").on(t.studentId, t.issueDate.desc()),
    index("invoices_status_idx").on(t.status),
    uniqueIndex("invoices_number_pair").on(t.numberYear, t.numberSeq),
    uniqueIndex("invoices_cancels_idx")
      .on(t.cancelsInvoiceId)
      .where(sql`${t.cancelsInvoiceId} is not null`),
    check("invoices_status", sql`${t.status} in ('draft','open','paid','cancelled')`),
    // Macht einen nummerierten Entwurf und eine unnummerierte finale Rechnung
    // strukturell unmoeglich.
    check("invoices_number_when_final", sql`(${t.status} = 'draft') = (${t.number} is null)`),
    check("invoices_issue_when_final", sql`${t.status} = 'draft' or ${t.issueDate} is not null`),
    check("invoices_paid_fields", sql`${t.status} <> 'paid' or ${t.paidOn} is not null`),
    check("invoices_total_consistent", sql`${t.totalCents} = ${t.netCents} + ${t.taxCents}`),
    check("invoices_amounts", sql`${t.netCents} >= 0 and ${t.totalCents} >= 0`),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    // RESTRICT: eine Stunde auf einer Rechnung – auch einem Entwurf – darf nicht
    // geloescht werden. Zum Entfernen wird erst die Position geloescht.
    lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "restrict" }),

    position: integer("position").notNull(),
    description: text("description").notNull(),
    serviceDate: date("service_date", { mode: "string" }),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit").notNull().default("Einheit"),
    // Darf negativ sein: § 14 Abs. 4 Nr. 7 UStG verlangt den Ausweis einer im
    // Voraus vereinbarten Entgeltminderung (Rabattzeile).
    unitPriceCents: integer("unit_price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),

    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_items_position").on(t.invoiceId, t.position),
    // Die Doppelabrechnungs-Sperre. Als DB-Invariante, damit sie auch bei
    // nebenlaeufiger Entwurfserstellung haelt.
    uniqueIndex("invoice_items_lesson_key")
      .on(t.lessonId)
      .where(sql`${t.lessonId} is not null`),
    check("invoice_items_quantity", sql`${t.quantity} > 0`),
    check("invoice_items_description", sql`length(btrim(${t.description})) > 0`),
    check("invoice_items_amount", sql`${t.amountCents} = ${t.quantity} * ${t.unitPriceCents}`),
  ],
);

/**
 * Kein Postgres-SEQUENCE: nextval() ist absichtlich nicht-transaktional, ein
 * Rollback verbrennt die Nummer dauerhaft und erzeugt genau die Luecken, die
 * § 14 Abs. 4 Nr. 4 UStG vermeiden will.
 */
export const invoiceCounters = pgTable(
  "invoice_counters",
  {
    year: integer("year").primaryKey(),
    lastSeq: integer("last_seq").notNull().default(0),
  },
  (t) => [check("invoice_counters_seq", sql`${t.lastSeq} >= 0`)],
);

/* ----------------------------------------------------------- Auth-Tabellen */

export const sessions = pgTable(
  "sessions",
  {
    // sha256(token) – niemals der Token selbst. Ein DB-Leak liefert damit
    // keine nutzbaren Sitzungen.
    tokenHash: bytea("token_hash").primaryKey(),
    createdAt: timestamp("created_at", tstz).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", tstz).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", tstz).notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_expires_idx").on(t.expiresAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    attemptedAt: timestamp("attempted_at", tstz).notNull().defaultNow(),
    success: boolean("success").notNull(),
  },
  (t) => [index("login_attempts_time_idx").on(t.attemptedAt.desc())],
);

export type Student = typeof students.$inferSelect;
export type Tariff = typeof tariffs.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Settings = typeof settings.$inferSelect;
