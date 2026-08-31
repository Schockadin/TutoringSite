import type { Metadata } from "next";
import Link from "next/link";
import { listInvoices } from "@/lib/actions/invoices";
import { INVOICE_STATUS, date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Rechnungen – Verwaltung" };

export default async function InvoicesPage() {
  const rows = (await listInvoices()) as unknown as {
    id: number;
    number: string | null;
    status: string;
    issueDate: string | null;
    totalCents: number;
    studentId: number;
    studentName: string;
  }[];

  const open = rows.filter((r) => r.status === "open").reduce((s, r) => s + r.totalCents, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rechnungen</h1>
          <p className="sub">
            {rows.length} Rechnungen · {money(open)} offen
          </p>
        </div>
        <Link href="/app/rechnungen/neu" className="btn btn-primary btn-sm">
          Rechnung erstellen
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <p>Noch keine Rechnungen erstellt.</p>
            <Link href="/app/rechnungen/neu" className="btn btn-primary btn-sm">
              Erste Rechnung erstellen
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Datum</th>
                <th>Empfänger</th>
                <th>Status</th>
                <th className="num">Betrag</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/app/rechnungen/${r.id}`}>{r.number ?? "Entwurf"}</Link>
                  </td>
                  <td>{date(r.issueDate)}</td>
                  <td>
                    <Link href={`/app/schueler/${r.studentId}`}>{r.studentName}</Link>
                  </td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{INVOICE_STATUS[r.status]}</span>
                  </td>
                  <td className="num">{money(r.totalCents)}</td>
                  <td className="num">
                    {r.status !== "draft" && (
                      <Link href={`/app/rechnungen/${r.id}/druck`} target="_blank">
                        Drucken
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
