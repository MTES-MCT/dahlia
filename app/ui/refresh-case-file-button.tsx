"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useRouter } from "next/navigation";
import {
  refreshCaseFile,
  type RefreshCaseFileResult,
} from "@/app/(protected)/case_files/[caseFileNumber]/actions";
import type { CaseFileDetail } from "@/app/lib/data/case-files";
import { formatDateFr } from "@/app/lib/case-file-format";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
};

// Button that re-fetches the current case file from Télérecours via the
// `refreshCaseFile` server action, then displays a success or error alert.
export function RefreshCaseFileButton({ caseFile }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshCaseFileResult | null>(null);

  function handleRefresh() {
    setResult(null);
    startTransition(async () => {
      const res = await refreshCaseFile(caseFile.caseFileNumber);
      setResult(res);
      // On success, refresh the server component so the new data is displayed.
      if (res.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className={clsx(fr.cx("fr-mb-2w"), "flex", "flex-col", "items-end")}>
      <Button
        iconId="fr-icon-refresh-line"
        onClick={handleRefresh}
        disabled={isPending}
        priority="secondary"
      >
        {isPending ? "Rafraîchissement…" : "Rafraîchir"}
      </Button>
      <span className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-grey", "italic")}>
        Mise à jour le {formatDateFr(caseFile.updatedAt)}
      </span>

      {result && (
        <div className={fr.cx("fr-mt-2w")}>
          {result.ok ? (
            <Alert severity="success" small description="Dossier rafraîchi avec succès" />
          ) : (
            <Alert
              severity="error"
              small
              description={`Échec du rafraîchissement : ${result.error}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
