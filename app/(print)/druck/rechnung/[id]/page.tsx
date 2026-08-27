import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getInvoice } from "@/lib/actions/invoices";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Rechnung", robots: { index: false, follow: false } };

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const data = await getInvoice(id);
  if (!data) notFound();
  const { invoice, items } = data;

  if (invoice.status === "draft") {
    return (
      <main className="container" style={{ padding: 40 }}>
        <p className="notice notice-warn">
          Entwürfe können nicht gedruckt werden. Bitte schreibe die Rechnung zuerst fest – erst
          dann erhält sie eine Rechnungsnummer, die § 14 Abs. 4 Nr. 4 UStG verlangt.
        </p>
      </main>
    );
  }

  const fileName = `Rechnung_${invoice.number}_${(invoice.recipientName ?? "").split(" ").pop() ?? ""}`;

  return (
    <>
      <PrintButton fileName={fileName} />

      <div className="invoice-sheet">
        {/* Absenderzeile über dem Adressfeld, wie im Fensterumschlag üblich */}
        <p className="invoice-sender-line">
          {invoice.issuerName} · {invoice.issuerAddress?.replace("\n", " · ")}
        </p>

        {/* Adressfeld in Fensterposition nach DIN 5008 */}
        <address className="invoice-address-field">
          {invoice.recipientName}
          <br />
          {invoice.recipientAddress?.split("\n").map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>

        <div className="invoice-meta">
          <table>
            <tbody>
              <tr>
                <th>Rechnungsnummer</th>
                <td>{invoice.number}</td>
              </tr>
              <tr>
                <th>Rechnungsdatum</th>
                <td>{date(invoice.issueDate)}</td>
              </tr>
              <tr>
                <th>Leistungszeitraum</th>
                <td>
                  {date(invoice.servicePeriodStart)} – {date(invoice.servicePeriodEnd)}
                </td>
              </tr>
              {invoice.issuerTaxNumber && (
                <tr>
                  <th>Steuernummer</th>
                  <td>{invoice.issuerTaxNumber}</td>
                </tr>
              )}
              {invoice.issuerVatId && (
                <tr>
                  <th>USt-IdNr.</th>
                  <td>{invoice.issuerVatId}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h1 className="invoice-title">
          {invoice.cancelsInvoiceId ? "Stornorechnung" : "Rechnung"} {invoice.number}
        </h1>

        {invoice.introText && <p className="invoice-intro">{invoice.introText}</p>}

        <table className="invoice-items">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Datum</th>
              <th>Leistung</th>
              <th className="num">Menge</th>
              <th className="num">Einzelpreis</th>
              <th className="num">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.position}</td>
                <td>{date(item.serviceDate)}</td>
                <td>{item.description}</td>
                <td className="num">
                  {item.quantity} {item.unit}
                </td>
                <td className="num">{money(item.unitPriceCents)}</td>
                <td className="num">{money(item.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="invoice-totals">
          <tbody>
            <tr>
              <th>Nettobetrag</th>
              <td className="num">{money(invoice.netCents)}</td>
            </tr>
            {(invoice.taxRateBp ?? 0) > 0 && (
              <tr>
                <th>zzgl. {(invoice.taxRateBp! / 100).toLocaleString("de-DE")} % Umsatzsteuer</th>
                <td className="num">{money(invoice.taxCents)}</td>
              </tr>
            )}
            <tr className="grand">
              <th>Rechnungsbetrag</th>
              <td className="num">{money(invoice.totalCents)}</td>
            </tr>
          </tbody>
        </table>

        {/* § 14 Abs. 4 Nr. 8 UStG: Hinweis auf die Steuerbefreiung */}
        <p className="invoice-tax-note">{invoice.taxNote}</p>

        <div className="invoice-payment">
          <p>
            Bitte überweise den Rechnungsbetrag bis zum <strong>{date(invoice.dueDate)}</strong> auf
            das folgende Konto:
          </p>
          <table>
            <tbody>
              {invoice.issuerAccountHolder && (
                <tr>
                  <th>Kontoinhaber</th>
                  <td>{invoice.issuerAccountHolder}</td>
                </tr>
              )}
              {invoice.issuerIban && (
                <tr>
                  <th>IBAN</th>
                  <td>{invoice.issuerIban}</td>
                </tr>
              )}
              {invoice.issuerBic && (
                <tr>
                  <th>BIC</th>
                  <td>{invoice.issuerBic}</td>
                </tr>
              )}
              <tr>
                <th>Verwendungszweck</th>
                <td>{invoice.number}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {invoice.footerNote && <p className="invoice-footer-note">{invoice.footerNote}</p>}

        <footer className="invoice-footer">
          <div>
            <strong>{invoice.issuerName}</strong>
            <br />
            {invoice.issuerAddress?.split("\n").map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </div>
          <div>
            {invoice.issuerEmail && (
              <>
                {invoice.issuerEmail}
                <br />
              </>
            )}
            {invoice.issuerPhone}
          </div>
        </footer>
      </div>
    </>
  );
}
