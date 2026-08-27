import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddItemForm } from "@/components/AddItemForm";
import { FinalizeButton, InvoiceLifecycle, RemoveItemButton } from "@/components/InvoiceActions";
import { getInvoice } from "@/lib/actions/invoices";
import { INVOICE_STATUS, date, money } from "@/lib/format";
import { berlinToday } from "@/lib/queries";

export const metadata: Metadata = { title: "Rechnung – Verwaltung" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const data = await getInvoice(id);
  if (!data) notFound();
  const { invoice, items, student } = data;
  const today = await berlinToday();
  const isDraft = invoice.status === "draft";

  return (
    <>
      <Link href="/app/rechnungen" className="back-link">
        &larr; Zurück zur Übersicht
      </Link>

      <div className="page-head">
        <div>
          <h1>{invoice.number ?? "Entwurf"}</h1>
          <p className="sub">
            <span className={`badge badge-${invoice.status}`}>{INVOICE_STATUS[invoice.status]}</span> ·{" "}
            <Link href={`/app/schueler/${student.id}`}>
              {student.firstName} {student.lastName}
            </Link>
            {invoice.servicePeriodStart && (
              <>
                {" "}
                · Leistungszeitraum {date(invoice.servicePeriodStart)} – {date(invoice.servicePeriodEnd)}
              </>
            )}
          </p>
        </div>
        {!isDraft && (
          <Link href={`/app/rechnungen/${id}/druck`} target="_blank" className="btn btn-primary btn-sm">
            Drucken / als PDF sichern
          </Link>
        )}
      </div>

      {invoice.cancelsInvoiceId && (
        <p className="notice notice-warn">
          Dies ist eine Stornorechnung.{" "}
          <Link href={`/app/rechnungen/${invoice.cancelsInvoiceId}`}>Zur Originalrechnung</Link>
        </p>
      )}

      <div className="form-section">
        <h2>Positionen</h2>
        {items.length === 0 ? (
          <p className="hint">
            Keine Positionen. Im gewählten Zeitraum gab es keine offenen Stunden – du kannst unten
            manuell Positionen hinzufügen.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Datum</th>
                  <th>Bezeichnung</th>
                  <th className="num">Menge</th>
                  <th className="num">Einzelpreis</th>
                  <th className="num">Betrag</th>
                  {isDraft && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.position}</td>
                    <td>{date(item.serviceDate)}</td>
                    <td className="wrap">{item.description}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{money(item.unitPriceCents)}</td>
                    <td className="num">{money(item.amountCents)}</td>
                    {isDraft && (
                      <td className="num">
                        <RemoveItemButton invoiceId={id} itemId={item.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={5}>Netto</th>
                  <th className="num">{money(invoice.netCents)}</th>
                  {isDraft && <th></th>}
                </tr>
                {invoice.taxCents > 0 && (
                  <tr>
                    <th colSpan={5}>Umsatzsteuer</th>
                    <th className="num">{money(invoice.taxCents)}</th>
                    {isDraft && <th></th>}
                  </tr>
                )}
                <tr>
                  <th colSpan={5}>Gesamt</th>
                  <th className="num">{money(invoice.totalCents)}</th>
                  {isDraft && <th></th>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {isDraft && (
        <>
          <div className="form-section">
            <h2>Weitere Position</h2>
            <p className="hint">
              Für Fahrtkosten außerhalb von Essen, Material oder einen Rabatt.
            </p>
            <AddItemForm invoiceId={id} />
          </div>

          <div className="form-section">
            <h2>Festschreiben</h2>
            <p className="hint">
              Beim Festschreiben werden die Positionen aus den Stunden neu aufgebaut, Absender- und
              Empfängerdaten auf die Rechnung kopiert und die fortlaufende Nummer vergeben. Danach
              ist die Rechnung unveränderlich.
            </p>
            <FinalizeButton id={id} />
          </div>
        </>
      )}

      <div className="form-section">
        <h2>Status</h2>
        {invoice.issueDate && (
          <p className="hint">
            Ausgestellt am {date(invoice.issueDate)}
            {invoice.dueDate && `, zahlbar bis ${date(invoice.dueDate)}`}
            {invoice.paidOn && ` · bezahlt am ${date(invoice.paidOn)}`}
          </p>
        )}
        <InvoiceLifecycle id={id} status={invoice.status} today={today} />
      </div>
    </>
  );
}
