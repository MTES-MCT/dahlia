"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CASE_FILE_COMMENT_MAX_LENGTH } from "@/app/lib/case-file-comment";
import { CollapsiblePanel } from "@/app/ui/panel/collapsible-panel";
import { updateCaseFileCommentFormAction } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions";

export type PieceCommentView = {
  encodedFileId: string;
  name: string;
  comment: string;
  // Opens the pièces tab on this pièce.
  href: string;
};

type Props = {
  jurisdictionCode: string;
  caseFileNumber: string;
  comment: string | null;
  pieceComments: PieceCommentView[];
};

// Local time of a successful save, e.g. "14h05".
function formatSaveTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(":", "h");
}

function PieceComments({ pieceComments }: { pieceComments: PieceCommentView[] }) {
  return (
    <div
      className={clsx(
        fr.cx("fr-mb-4w", "fr-pb-3w"),
        "border-0",
        "border-b",
        "border-solid",
        "border-(--border-default-grey)",
      )}
    >
      <p className={fr.cx("fr-label", "fr-mb-2w")}>Commentaires des pièces</p>
      <ul className={clsx(fr.cx("fr-raw-list", "fr-m-0"), "flex", "flex-col", "gap-3")}>
        {pieceComments.map((piece) => (
          <li
            key={piece.encodedFileId}
            className={clsx(
              fr.cx("fr-m-0", "fr-pt-3v", "fr-pb-1w", "fr-px-2w"),
              "bg-(--background-alt-grey)",
              "border-0",
              "border-l-3",
              "border-solid",
              "border-l-(--border-active-blue-france)",
            )}
          >
            <p className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-1v")}>
              Commentaire sur « {piece.name} »
            </p>
            <p className={clsx(fr.cx("fr-text--sm", "fr-mb-1v"), "whitespace-pre-line")}>
              {piece.comment}
            </p>
            <Button
              priority="tertiary no outline"
              size="small"
              iconId="fr-icon-eye-line"
              linkProps={{ href: piece.href }}
            >
              Voir la pièce
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "Commentaires" block of the synthèse tab: read-only pièce comments (edited
// from the pièces tab) and the editable general comment of the case file.
export function CaseFileCommentsPanel({
  jurisdictionCode,
  caseFileNumber,
  comment,
  pieceComments,
}: Props) {
  const savedValue = comment ?? "";
  const [value, setValue] = useState(savedValue);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [result, formAction, isPending] = useActionState(updateCaseFileCommentFormAction, null);
  const isDirty = value !== savedValue;

  // React to a new action result during render (guarded against re-runs). The
  // server trims the comment, so align the field with what was stored.
  const [handledResult, setHandledResult] = useState(result);
  if (result !== handledResult) {
    setHandledResult(result);
    if (result?.ok) {
      setValue((current) => current.trim());
      setSavedAt(formatSaveTime(new Date()));
    }
  }

  return (
    <CollapsiblePanel
      title="Commentaires"
      hint="Visible par les agents en charge du dossier"
      defaultOpen
    >
      {pieceComments.length > 0 && <PieceComments pieceComments={pieceComments} />}

      <form action={formAction}>
        <input type="hidden" name="jurisdictionCode" value={jurisdictionCode} />
        <input type="hidden" name="caseFileNumber" value={caseFileNumber} />

        <Input
          label="Commentaire général"
          textArea
          nativeTextAreaProps={{
            name: "comment",
            rows: 4,
            maxLength: CASE_FILE_COMMENT_MAX_LENGTH,
            value,
            onChange: (event) => setValue(event.currentTarget.value),
          }}
        />

        <div className={clsx("flex", "flex-wrap", "items-center", "gap-x-6", "gap-y-2")}>
          <ButtonsGroup
            inlineLayoutWhen="md and up"
            buttonsSize="small"
            className={fr.cx("fr-mb-0")}
            buttons={[
              {
                children: isPending ? "Enregistrement…" : "Enregistrer",
                type: "submit",
                disabled: !isDirty || isPending,
              },
              {
                children: "Annuler",
                priority: "secondary",
                type: "button",
                disabled: !isDirty || isPending,
                onClick: () => setValue(savedValue),
              },
            ]}
          />
          <p
            role="status"
            className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-(--text-mention-grey)")}
          >
            {isDirty ? (
              "Modifications non enregistrées."
            ) : savedAt ? (
              <>
                <span className={fr.cx("fr-icon-check-line", "fr-icon--sm")} aria-hidden="true" />{" "}
                Enregistré à {savedAt}.
              </>
            ) : null}
          </p>
        </div>

        {result && !result.ok && (
          <div className={fr.cx("fr-mt-2w")}>
            <Alert
              severity="error"
              small
              description={`Échec de l'enregistrement : ${result.error}`}
            />
          </div>
        )}
      </form>
    </CollapsiblePanel>
  );
}
