"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useRowSelectionState } from "@/app/ui/table/row-selection";

type Props = {
  caseFileNumber: string;
};

// Action bar shown below the pièces table: downloads every selected pièce as a
// single zip, fetched through the backend so the Télérecours token stays server-side.
export function PiecesDownloadBar({ caseFileNumber }: Props) {
  const { selectedIds, clear } = useRowSelectionState();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const count = selectedIds.length;

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const query = new URLSearchParams();
        for (const id of selectedIds) {
          query.append("id", id);
        }
        const response = await fetch(
          `/case_files/${encodeURIComponent(caseFileNumber)}/pieces/download?${query.toString()}`,
        );

        if (!response.ok) {
          setError(await response.text());
          return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filenameMatch = response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filenameMatch?.[1] ?? "pieces.zip";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        clear();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Erreur inconnue");
      }
    });
  }

  return (
    <div className={clsx(fr.cx("fr-mb-2w"), "flex", "flex-col", "gap-2")}>
      <div className={clsx("flex", "items-center", "gap-4")}>
        <Button
          iconId="fr-icon-download-line"
          onClick={handleDownload}
          disabled={count === 0 || isPending}
          priority="secondary"
        >
          {isPending ? "Préparation du téléchargement…" : "Télécharger les pièces"}
        </Button>
        <span className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-grey")}>
          {count === 0
            ? "Aucune pièce sélectionnée"
            : `${count} pièce${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`}
        </span>
      </div>

      {error && <Alert severity="error" small description={`Échec du téléchargement : ${error}`} />}
    </div>
  );
}
