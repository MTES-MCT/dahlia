"use client";

import { useActionState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { updatePieceMetadataFormAction } from "@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions";

type Props = {
  encodedFileId: string;
  dahliaName: string;
  number: string;
  comment: string;
};

// Editable form for the user-managed metadata of a pièce (renamed name, number,
// comment). Saved through the `updatePieceMetadataFormAction` server action.
export function PieceMetadataForm({ encodedFileId, dahliaName, number, comment }: Props) {
  const [result, formAction, isPending] = useActionState(updatePieceMetadataFormAction, null);

  return (
    <form action={formAction} className={fr.cx("fr-mb-3w")}>
      <input type="hidden" name="encodedFileId" value={encodedFileId} />

      <Input
        label="Nom sur DAHLIA"
        nativeInputProps={{
          name: "dahliaName",
          defaultValue: dahliaName,
        }}
        className={fr.cx("fr-mb-2w")}
      />

      <Input
        label="Numéro"
        hintText="Chiffres uniquement, les zéros initiaux sont conservés (ex. 002)"
        nativeInputProps={{
          name: "number",
          defaultValue: number,
          inputMode: "numeric",
          pattern: "[0-9]*",
        }}
        className={fr.cx("fr-mb-2w")}
      />

      <Input
        label="Commentaire"
        textArea
        nativeTextAreaProps={{
          name: "comment",
          defaultValue: comment,
          rows: 4,
        }}
        className={fr.cx("fr-mb-2w")}
      />

      <Button type="submit" disabled={isPending} iconId="fr-icon-save-line">
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>

      {result && (
        <div className={fr.cx("fr-mt-2w")}>
          {result.ok ? (
            <Alert severity="success" small description="Pièce enregistrée avec succès" />
          ) : (
            <Alert
              severity="error"
              small
              description={`Échec de l'enregistrement : ${result.error}`}
            />
          )}
        </div>
      )}
    </form>
  );
}
