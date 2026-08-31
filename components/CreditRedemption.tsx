"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemLesson, releaseLesson } from "@/lib/actions/credits";

/**
 * Verrechnung einer einzelnen Stunde gegen ein Guthaben, von Hand.
 *
 * Beim Markieren als gehalten passiert das automatisch – hier lässt es sich
 * nachholen oder rückgängig machen, etwa wenn das Guthaben erst später
 * angelegt wurde.
 */
export function CreditRedemption({
  lessonId,
  studentId,
  packageLabel,
  canRedeem,
}: {
  lessonId: number;
  studentId: number;
  packageLabel: string | null;
  canRedeem: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (packageLabel) {
    return (
      <>
        <p className="hint">
          Diese Stunde ist gegen das Guthaben „{packageLabel}" verrechnet und erscheint deshalb
          nicht in der offenen Abrechnung.
        </p>
        {error && <p className="notice notice-error">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() =>
              start(() =>
                releaseLesson(lessonId).then((r) => {
                  setError(r.error ?? null);
                  router.refresh();
                }),
              )
            }
          >
            Verrechnung aufheben
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="hint">
        Diese Stunde ist nicht gegen ein Guthaben verrechnet und wird normal berechnet.
      </p>
      {error && <p className="notice notice-error">{error}</p>}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || !canRedeem}
          onClick={() =>
            start(() =>
              redeemLesson(lessonId).then((r) => {
                setError(r.error ?? null);
                if (!r.error) router.refresh();
              }),
            )
          }
        >
          Gegen Guthaben verrechnen
        </button>
        <Link href={`/app/schueler/${studentId}`} className="btn btn-secondary btn-sm">
          Guthaben verwalten
        </Link>
      </div>
    </>
  );
}
