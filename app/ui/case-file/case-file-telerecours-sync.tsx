"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { type RefreshCaseFileResult } from "@/app/(protected)/case_files/[caseFileNumber]/actions";
import { formatDateTimeFr } from "@/app/lib/case-file-format";

type Props = {
  caseFileNumber: string;
  telerecoursSyncAt: Date | null;
};

export function telerecoursSyncPath(caseFileNumber: string): string {
  return `/case_files/${encodeURIComponent(caseFileNumber)}/telerecours-sync`;
}

// Overlapping refresh calls for the same dossier (React Strict Mode in
// dev, or a remount while a request is still in flight) share one promise so
// Télérecours is not hit twice. The entry is cleared when the call finishes,
// so opening the dossier again later starts a new sync.
const refreshInFlight = new Map<string, Promise<RefreshCaseFileResult>>();

async function requestTelerecoursSync(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  try {
    const response = await fetch(telerecoursSyncPath(caseFileNumber), { method: "POST" });
    if (!response.ok) {
      return { ok: false, error: `Erreur HTTP ${response.status}` };
    }
    return (await response.json()) as RefreshCaseFileResult;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function refreshCaseFileCoalesced(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  const existing = refreshInFlight.get(caseFileNumber);
  if (existing) return existing;

  const pending = requestTelerecoursSync(caseFileNumber).finally(() => {
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
// The request goes through fetch() rather than the Server Action: Next.js wraps
// every Server Action in startTransition, which marks the whole page as pending
// and disables forms until Télérecours answers.
export function CaseFileTelerecoursSync({ caseFileNumber, telerecoursSyncAt }: Props) {
  const router = useRouter();
  const [previousCaseFileNumber, setPreviousCaseFileNumber] = useState(caseFileNumber);
  const [isPending, setIsPending] = useState(Boolean(caseFileNumber));
  const [error, setError] = useState<string | null>(null);

  // Reset the pending/error display when the dossier changes. Adjusting state
  // during render avoids a synchronous setState inside the effect below.
  if (caseFileNumber !== previousCaseFileNumber) {
    setPreviousCaseFileNumber(caseFileNumber);
    setIsPending(Boolean(caseFileNumber));
    setError(null);
  }

  useEffect(() => {
    if (!caseFileNumber) return;

    let cancelled = false;

    refreshCaseFileCoalesced(caseFileNumber).then((result) => {
      if (cancelled) return;
      setIsPending(false);
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
