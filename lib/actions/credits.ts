"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { creditPackages, creditRedemptions, db } from "@/lib/db";
import * as v from "@/lib/validate";

/**
 * Vorausbezahlte Stunden.
 *
 * Ein Guthaben deckt Stunden ab, die dann nicht mehr einzeln berechnet werden -
 * das ist der Kern. Berechnet wird stattdessen das Paket selbst, einmal.
 */

export type PackageState = { errors?: v.FieldErrors; message?: string };

export type PackageWithBalance = {
  id: number;
  studentId: number;
  kind: string;
  label: string;
  totalUnits: number | null;
  unitDurationMinutes: number | null;
  creditCents: number | null;
  priceCents: number;
  purchasedOn: string;
  paidOn: string | null;
  expiresOn: string | null;
  notes: string | null;
  cancelledAt: string | null;
  usedUnits: number;
  usedCents: number;
  /** Verbleibende Einheiten bei kind='units', sonst null. */
  remainingUnits: number | null;
  /** Verbleibendes Guthaben in Cent bei kind='amount', sonst null. */
  remainingCents: number | null;
  redemptionCount: number;
  invoiceId: number | null;
  expired: boolean;
};

const PACKAGE_SELECT = sql`
  select
    p.id, p.student_id as "studentId", p.kind, p.label,
    p.total_units as "totalUnits", p.unit_duration_minutes as "unitDurationMinutes",
    p.credit_cents as "creditCents", p.price_cents as "priceCents",
    p.purchased_on as "purchasedOn", p.paid_on as "paidOn", p.expires_on as "expiresOn",
    p.notes, p.cancelled_at as "cancelledAt",
    coalesce(u.units, 0)::int as "usedUnits",
    coalesce(u.cents, 0)::int as "usedCents",
    case when p.kind = 'units' then (p.total_units - coalesce(u.units, 0))::int end as "remainingUnits",
    case when p.kind = 'amount' then (p.credit_cents - coalesce(u.cents, 0))::int end as "remainingCents",
    coalesce(u.anzahl, 0)::int as "redemptionCount",
    ii.invoice_id as "invoiceId",
    (p.expires_on is not null and p.expires_on < (now() at time zone 'Europe/Berlin')::date) as "expired"
  from credit_packages p
  left join lateral (
    select sum(r.units_used) as units, sum(r.cents_used) as cents, count(*) as anzahl
    from credit_redemptions r where r.package_id = p.id
  ) u on true
  left join invoice_items ii on ii.package_id = p.id
`;

export async function listPackagesForStudent(studentId: number): Promise<PackageWithBalance[]> {
  const rows = await db.execute<PackageWithBalance>(sql`
    ${PACKAGE_SELECT}
    where p.student_id = ${studentId}
    order by p.cancelled_at nulls first, p.purchased_on desc, p.id desc
  `);
  return rows as unknown as PackageWithBalance[];
}

export async function getPackage(id: number): Promise<PackageWithBalance | null> {
  const rows = (await db.execute<PackageWithBalance>(
    sql`${PACKAGE_SELECT} where p.id = ${id}`,
  )) as unknown as PackageWithBalance[];
  return rows[0] ?? null;
}

/** Zusammenfassung über alle Schüler:innen – für die Übersichtsseite. */
export async function getCreditOverview() {
  const [row] = (await db.execute<{
    openPackages: number;
    remainingUnits: number;
    remainingCents: number;
    unpaidCents: number;
  }>(sql`
    with saldo as (${PACKAGE_SELECT} where p.cancelled_at is null)
    select
      count(*) filter (
        where not expired and (coalesce("remainingUnits",0) > 0 or coalesce("remainingCents",0) > 0)
      )::int as "openPackages",
      coalesce(sum("remainingUnits") filter (where not expired), 0)::int as "remainingUnits",
      coalesce(sum("remainingCents") filter (where not expired), 0)::int as "remainingCents",
      coalesce(sum("priceCents") filter (where "paidOn" is null), 0)::int as "unpaidCents"
    from saldo
  `)) as unknown as {
    openPackages: number; remainingUnits: number; remainingCents: number; unpaidCents: number;
  }[];
  return row!;
}

/* ------------------------------------------------------------- Verrechnung */

/**
 * Sucht das Guthaben, das für eine Stunde einspringen soll.
 *
 * Reihenfolge: was zuerst verfällt, wird zuerst verbraucht; danach das ältere
 * Paket. Ein Guthaben, das nie verfällt, kommt zuletzt dran.
 *
 * Teilverrechnung findet bewusst NICHT statt: reicht ein Geldguthaben nicht für
 * die ganze Stunde, bleibt die Stunde normal abzurechnen. Eine halb gedeckte
 * Stunde müsste sonst mit reduziertem Betrag auf die Rechnung, was sich mit der
 * Unveränderlichkeit festgeschriebener Rechnungen schlecht verträgt.
 */
async function findCoveringPackage(
  tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  lessonId: number,
) {
  const rows = (await tx.execute(sql`
    with saldo as (${PACKAGE_SELECT} where p.cancelled_at is null)
    select s.id, s.kind,
           case when s.kind = 'units' then 1 else 0 end as "unitsUsed",
           case when s.kind = 'amount' then l.price_cents else 0 end as "centsUsed"
    from lessons l
    join saldo s on s."studentId" = l.student_id
    where l.id = ${lessonId}
      and not s.expired
      and (s."expiresOn" is null
           or s."expiresOn" >= (l.starts_at at time zone 'Europe/Berlin')::date)
      and (
        (s.kind = 'units'
          and s."unitDurationMinutes" = l.duration_minutes
          and s."remainingUnits" >= 1)
        or
        (s.kind = 'amount'
          and l.price_cents is not null
          and s."remainingCents" >= l.price_cents)
      )
    order by s."expiresOn" nulls last, s."purchasedOn", s.id
    limit 1
  `)) as unknown as { id: number; kind: string; unitsUsed: number; centsUsed: number }[];
  return rows[0] ?? null;
}

/**
 * Verrechnet eine Stunde gegen ein Guthaben. Ohne `packageId` wird das
 * passende Guthaben automatisch gesucht.
 */
export async function redeemLesson(
  lessonId: number,
  packageId?: number,
): Promise<{ error?: string; packageId?: number }> {
  await requireSession();

  try {
    return await db.transaction(async (tx) => {
      const onInvoice = (await tx.execute(
        sql`select count(*)::int as c from invoice_items where lesson_id = ${lessonId}`,
      )) as unknown as { c: number }[];
      if (onInvoice[0]!.c > 0) {
        return { error: "Diese Stunde steht bereits auf einer Rechnung und kann nicht zusätzlich verrechnet werden." };
      }

      const match = packageId
        ? ((await tx.execute(sql`
            with saldo as (${PACKAGE_SELECT} where p.id = ${packageId} and p.cancelled_at is null)
            select s.id, s.kind,
                   case when s.kind = 'units' then 1 else 0 end as "unitsUsed",
                   case when s.kind = 'amount' then l.price_cents else 0 end as "centsUsed"
            from lessons l join saldo s on s."studentId" = l.student_id
            where l.id = ${lessonId}
              and ((s.kind = 'units' and s."remainingUnits" >= 1)
                or (s.kind = 'amount' and l.price_cents is not null and s."remainingCents" >= l.price_cents))
          `)) as unknown as { id: number; kind: string; unitsUsed: number; centsUsed: number }[])[0] ?? null
        : await findCoveringPackage(tx, lessonId);

      if (!match) {
        return {
          error: packageId
            ? "Dieses Guthaben reicht für die Stunde nicht aus oder passt nicht zur Dauer."
            : "Es gibt kein passendes Guthaben mit ausreichendem Rest.",
        };
      }

      await tx.insert(creditRedemptions).values({
        packageId: match.id,
        lessonId,
        unitsUsed: match.unitsUsed,
        centsUsed: match.centsUsed,
      });

      return { packageId: match.id };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("credit_redemptions_lesson_key")) {
      return { error: "Diese Stunde ist bereits gegen ein Guthaben verrechnet." };
    }
    console.error("[Guthaben]", err);
    return { error: "Die Stunde konnte nicht verrechnet werden." };
  }
}

/** Nimmt eine Verrechnung zurück – die Stunde wird wieder normal abrechenbar. */
export async function releaseLesson(lessonId: number): Promise<{ error?: string }> {
  await requireSession();
  await db.delete(creditRedemptions).where(eq(creditRedemptions.lessonId, lessonId));
  revalidatePath("/app/stunden");
  revalidatePath("/app");
  return {};
}

/* ------------------------------------------------------------- Verwaltung */

export async function createPackage(
  studentId: number,
  _prev: PackageState,
  formData: FormData,
): Promise<PackageState> {
  await requireSession();
  const errors: v.FieldErrors = {};

  const kind = String(formData.get("kind") ?? "units");
  if (kind !== "units" && kind !== "amount") {
    return { errors: { kind: "Unbekannte Guthabenart." } };
  }

  const label = v.required(errors, "label", formData.get("label"), "eine Bezeichnung", 120);
  const priceCents = v.euroToCents(errors, "priceCents", formData.get("priceCents"), "den Preis", {
    allowEmpty: false,
  });
  const purchasedOn = v.dateField(errors, "purchasedOn", formData.get("purchasedOn"), "das Kaufdatum");

  const totalUnits =
    kind === "units"
      ? v.integer(errors, "totalUnits", formData.get("totalUnits"), "die Anzahl der Einheiten", {
          min: 1,
          max: 500,
        })
      : null;
  const unitDurationMinutes =
    kind === "units"
      ? v.integer(errors, "unitDurationMinutes", formData.get("unitDurationMinutes"), "die Dauer je Einheit", {
          min: 1,
          max: 600,
        })
      : null;
  const creditCents =
    kind === "amount"
      ? v.euroToCents(errors, "creditCents", formData.get("creditCents"), "das Guthaben", {
          allowEmpty: false,
        })
      : null;

  const expiresRaw = String(formData.get("expiresOn") ?? "").trim();
  const expiresOn = expiresRaw ? v.dateField(errors, "expiresOn", expiresRaw, "das Ablaufdatum") : null;
  if (expiresOn && purchasedOn && expiresOn < purchasedOn) {
    errors.expiresOn = "Das Ablaufdatum darf nicht vor dem Kaufdatum liegen.";
  }

  const paidRaw = String(formData.get("paidOn") ?? "").trim();
  const paidOn = paidRaw ? v.dateField(errors, "paidOn", paidRaw, "das Zahldatum") : null;

  if (Object.keys(errors).length > 0) {
    return { errors, message: "Bitte überprüfe die markierten Felder." };
  }

  await db.insert(creditPackages).values({
    studentId,
    kind,
    label,
    totalUnits,
    unitDurationMinutes,
    creditCents,
    priceCents: priceCents!,
    purchasedOn,
    paidOn,
    expiresOn,
    notes: v.text(formData.get("notes"), { max: 1000 }),
  });

  revalidatePath(`/app/schueler/${studentId}`);
  revalidatePath("/app");
  return { message: "Guthaben angelegt." };
}

export async function setPackagePaid(id: number, paidOn: string | null) {
  await requireSession();
  await db.update(creditPackages).set({ paidOn }).where(eq(creditPackages.id, id));
  revalidatePath("/app");
}

/**
 * Storniert ein Guthaben. Bereits verrechnete Stunden bleiben verrechnet -
 * sie wurden ja erbracht. Nur der Rest verfällt.
 */
export async function cancelPackage(id: number): Promise<{ error?: string }> {
  await requireSession();
  const pkg = await getPackage(id);
  if (!pkg) return { error: "Dieses Guthaben gibt es nicht." };

  await db
    .update(creditPackages)
    .set({ cancelledAt: pkg.cancelledAt ? null : new Date().toISOString() })
    .where(eq(creditPackages.id, id));
  revalidatePath(`/app/schueler/${pkg.studentId}`);
  revalidatePath("/app");
  return {};
}
