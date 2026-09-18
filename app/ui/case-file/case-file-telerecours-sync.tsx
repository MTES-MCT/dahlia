"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import {
  refreshCaseFile,
  type RefreshCaseFileResult,
} from "@/app/(protected)/case_files/[caseFileNumber]/actions";
import { formatDateTimeFr } from "@/app/lib/case-file-format";

type Props = {
  caseFileNumber: string;
  telerecoursSyncAt: Date | null;
};

// Overlapping refreshCaseFile calls for the same dossier (React Strict Mode in
// dev, or a remount while a request is still in flight) share one promise so
// Télérecours is not hit twice. The entry is cleared when the call finishes,
// so opening the dossier again later starts a new sync.
const refreshInFlight = new Map<string, Promise<RefreshCaseFileResult>>();

function refreshCaseFileCoalesced(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  const existing = refreshInFlight.get(caseFileNumber);
  if (existing) return existing;

  const pending = refreshCaseFile(caseFileNumber).finally(() => {
    refreshInFlight.delete(caseFileNumber);
  });
  refreshInFlight.set(caseFileNumber, pending);
  return pending;
}

function formatTelerecoursSyncLabel(telerecoursSyncAt: Date | null): string {
  return telerecoursSyncAt
    ? `Dernière synchronisation le ${formatDateTimeFr(telerecoursSyncAt)}`
    : "Aucune synchronisation Télérecours";
}

// Shown under "Détails du dossier". On mount (each visit of the case file page)
// it re-runs the same Télérecours enrichment as the debug "Rafraîchir" button.
export function CaseFileTelerecoursSync({ caseFileNumber, telerecoursSyncAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseFileNumber) return;

    let cancelled = false;
    startTransition(async () => {
      setError(null);
      const result = await refreshCaseFileCoalesced(caseFileNumber);
      if (cancelled) return;
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [caseFileNumber, router]);

  return (
    <div
      className={clsx(
        fr.cx("fr-text--xs", "fr-mb-0"),
        "max-w-56 text-right text-(--text-mention-grey) italic",
      )}
      aria-live="polite"
    >
      <p className={fr.cx("fr-mb-0")}>{formatTelerecoursSyncLabel(telerecoursSyncAt)}</p>
      {isPending ? <p className={fr.cx("fr-mb-0")}>Synchronisation…</p> : null}
      {error ? (
        <p className={clsx(fr.cx("fr-mb-0"), "text-(--text-default-error)")}>
          Échec de la synchronisation : {error}
        </p>
      ) : null}
    </div>
  );
}
