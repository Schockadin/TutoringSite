"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteMessage, setMessageStatus } from "@/lib/actions/contact";

export function MessageActions({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="form-actions">
      {status !== "new" && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => start(() => setMessageStatus(id, "new"))}
        >
          Als ungelesen markieren
        </button>
      )}
      {status !== "archived" ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => start(() => setMessageStatus(id, "archived"))}
        >
          Archivieren
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => start(() => setMessageStatus(id, "read"))}
        >
          Aus dem Archiv holen
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Nachricht endgültig löschen? Das lässt sich nicht rückgängig machen.")) return;
          start(() =>
            deleteMessage(id).then(() => router.push("/app/nachrichten")),
          );
        }}
      >
        Löschen
      </button>
    </div>
  );
}
