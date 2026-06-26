"use client";

import { useState, useTransition } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useRouter } from "next/navigation";
import {
  updatePieceMetadata,
  type UpdatePieceResult,
} from "@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions";

type Props = {
  encodedFileId: string;
  dahliaName: string;
  number: string;
  comment: string;
};

// Editable form for the user-managed metadata of a pièce (renamed name, number,
// comment). Saved through the `updatePieceMetadata` server action.
export function PieceMetadataForm({ encodedFileId, dahliaName, number, comment }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdatePieceResult | null>(null);

  const [dahliaNameValue, setDahliaNameValue] = useState(dahliaName);
  // Keep only digits so the number stays a string of digits (leading zeros kept).
  const [numberValue, setNumberValue] = useState(number);
  const [commentValue, setCommentValue] = useState(comment);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await updatePieceMetadata(encodedFileId, {
        dahliaName: dahliaNameValue,
        number: numberValue,
        comment: commentValue,
      });
      setResult(res);
      if (res.ok) {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={fr.cx("fr-mb-3w")}>
      <Input
        label="Renommée"
        nativeInputProps={{
          value: dahliaNameValue,
          onChange: (e) => setDahliaNameValue(e.target.value),
        }}
        className={fr.cx("fr-mb-2w")}
      />

      <Input
        label="Numéro"
        hintText="Chiffres uniquement, les zéros initiaux sont conservés (ex. 002)"
        nativeInputProps={{
          value: numberValue,
          inputMode: "numeric",
          onChange: (e) => setNumberValue(e.target.value.replace(/\D/g, "")),
        }}
        className={fr.cx("fr-mb-2w")}
      />

      <Input
        label="Commentaire"
        textArea
        nativeTextAreaProps={{
          value: commentValue,
          onChange: (e) => setCommentValue(e.target.value),
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
