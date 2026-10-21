"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { type RefreshCaseFileResult } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions";
import { formatDateTimeFr } from "@/app/lib/case-file-format";
import { caseFileHref } from "@/app/lib/case-file-key";
import { withDevelopmentDetail } from "@/app/lib/development-detail";
import { TELERECOURS_SYNC_RATE_LIMIT_MESSAGE } from "@/app/lib/telerecours-sync-rate-limit-message";

type Props = {
  jurisdictionCode: string;
  caseFileNumber: string;
  telerecoursSyncAt: Date | null;
};

const SYNC_FAILURE = "Échec de la synchronisation";

// The refresh action already returns SYNC_FAILURE, with the diagnostic appended
// in development. Other failures ("Dossier introuvable.", network) are still
// prefixed here. Outside development every message collapses to SYNC_FAILURE,
// even if a caller forgot to strip the upstream detail.
export function formatTelerecoursSyncError(error: string): string {
  if (error === TELERECOURS_SYNC_RATE_LIMIT_MESSAGE) {
    return error;
  }
  if (error === SYNC_FAILURE || error.startsWith(`${SYNC_FAILURE} : `)) {
    return process.env.NODE_ENV === "development" ? error : SYNC_FAILURE;
  }
  return withDevelopmentDetail(SYNC_FAILURE, error);
}

export function telerecoursSyncPath(jurisdictionCode: string, caseFileNumber: string): string {
  return caseFileHref({ jurisdictionCode, caseFileNumber }, "/telerecours-sync");
}

// Overlapping refresh calls for the same dossier (React Strict Mode in
// dev, or a remount while a request is still in flight) share one promise so
// Télérecours is not hit twice. Entries are keyed by sync path, which identifies
// the dossier (court + number). The entry is cleared when the call finishes, so
// opening the dossier again later starts a new sync.
const refreshInFlight = new Map<string, Promise<RefreshCaseFileResult>>();

function isRefreshCaseFileResult(body: unknown): body is RefreshCaseFileResult {
  if (!body || typeof body !== "object" || !("ok" in body)) return false;
  if (body.ok === true) return true;
  return body.ok === false && "error" in body && typeof body.error === "string";
}

async function requestTelerecoursSync(syncPath: string): Promise<RefreshCaseFileResult> {
  try {
    const response = await fetch(syncPath, { method: "POST" });
    // A 429 still carries the public refusal in JSON. Read it before treating
    // the HTTP status as an opaque failure.
    try {
      const body: unknown = await response.json();
      if (isRefreshCaseFileResult(body)) {
        return body.ok ? { ok: true } : { ok: false, error: body.error };
      }
    } catch {
      // Non-JSON body: fall through to the status code.
    }
    if (!response.ok) {
      return { ok: false, error: `Erreur HTTP ${response.status}` };
    }
    return { ok: false, error: "Connexion impossible." };
  } catch (error) {
    // Network failures stay in the browser console. The message shown in the
    // page must not carry the exception text. A non-JSON body is handled above.
    console.error(error);
    return { ok: false, error: "Connexion impossible." };
  }
}

function refreshCaseFileCoalesced(syncPath: string): Promise<RefreshCaseFileResult> {
  const existing = refreshInFlight.get(syncPath);
  if (existing) return existing;

  const pending = requestTelerecoursSync(syncPath).finally(() => {
    refreshInFlight.delete(syncPath);
  });
  refreshInFlight.set(syncPath, pending);
  return pending;
}

function formatTelerecoursSyncLabel(telerecoursSyncAt: Date | null): string {
  return telerecoursSyncAt
    ? `Dernière synchronisation le ${formatDateTimeFr(telerecoursSyncAt)}`
    : "Aucune synchronisation Télérecours";
}

// Shown under the status badge of the case-file header. On mount (each visit of the case file page)
// it re-runs the same Télérecours enrichment as the debug "Rafraîchir" button.
// The request goes through fetch() rather than the Server Action: Next.js wraps
// every Server Action in startTransition, which marks the whole page as pending
// and disables forms until Télérecours answers.
export function CaseFileTelerecoursSync({
  jurisdictionCode,
  caseFileNumber,
  telerecoursSyncAt,
}: Props) {
  const router = useRouter();
  // Empty when there is no dossier to sync; otherwise identifies the dossier.
  const syncPath = caseFileNumber ? telerecoursSyncPath(jurisdictionCode, caseFileNumber) : "";
  const [previousSyncPath, setPreviousSyncPath] = useState(syncPath);
  const [isPending, setIsPending] = useState(Boolean(syncPath));
  const [error, setError] = useState<string | null>(null);

  // Reset the pending/error display when the dossier changes. Adjusting state
  // during render avoids a synchronous setState inside the effect below.
  if (syncPath !== previousSyncPath) {
    setPreviousSyncPath(syncPath);
    setIsPending(Boolean(syncPath));
    setError(null);
  }

  useEffect(() => {
    if (!syncPath) return;

    let cancelled = false;

    refreshCaseFileCoalesced(syncPath).then((result) => {
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
  }, [syncPath, router]);

  return (
    <div
      className={clsx(fr.cx("fr-text--xs", "fr-mb-0"), "text-(--text-mention-grey) italic")}
      aria-live="polite"
    >
      {/* While syncing, the notice replaces the last-sync date it is about to update. */}
      <p className={fr.cx("fr-mb-0")}>
        {isPending ? "Synchronisation…" : formatTelerecoursSyncLabel(telerecoursSyncAt)}
      </p>
      {error ? (
        <p className={clsx(fr.cx("fr-mb-0"), "text-(--text-default-error)")}>
          {formatTelerecoursSyncError(error)}
        </p>
      ) : null}
    </div>
  );
}
