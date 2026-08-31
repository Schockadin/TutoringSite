import type { Metadata } from "next";
import Link from "next/link";
import { listMessages } from "@/lib/actions/contact";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Nachrichten – Verwaltung" };

const STATUS_LABEL: Record<string, string> = {
  new: "neu",
  read: "gelesen",
  archived: "archiviert",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  const { archiv } = await searchParams;
  const showArchived = archiv === "1";
  const rows = await listMessages(showArchived);
  const unread = rows.filter((m) => m.status === "new").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nachrichten</h1>
          <p className="sub">
            Anfragen über das Kontaktformular
            {unread > 0 && ` · ${unread} ungelesen`}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <Link
          href="/app/nachrichten"
          className={showArchived ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
        >
          Posteingang
        </Link>
        <Link
          href="/app/nachrichten?archiv=1"
          className={showArchived ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
        >
          Inkl. Archiv
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <p>Keine Nachrichten.</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Eingegangen</th>
                <th>Absender:in</th>
                <th>Fach</th>
                <th>Nachricht</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/app/nachrichten/${m.id}`}>
                      {date(m.createdAt.slice(0, 10))}
                    </Link>
                  </td>
                  <td>
                    <strong style={{ fontWeight: m.status === "new" ? 700 : 400 }}>{m.name}</strong>
                    <br />
                    <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                      {m.email}
                    </span>
                  </td>
                  <td>{m.subject ?? "–"}</td>
                  <td className="wrap">
                    {m.message.length > 90 ? `${m.message.slice(0, 90)}…` : m.message}
                  </td>
                  <td>
                    <span
                      className={
                        m.status === "new"
                          ? "badge badge-open"
                          : m.status === "archived"
                            ? "badge badge-draft"
                            : "badge badge-paid"
                      }
                    >
                      {STATUS_LABEL[m.status]}
                    </span>
                    {m.notifyError && (
                      <>
                        <br />
                        <span className="badge badge-cancelled" title={m.notifyError}>
                          Mail nicht zugestellt
                        </span>
                      </>
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
