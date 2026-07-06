"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import type { LitigationType, RightType } from "@prisma/client";
import { LITIGATION_TYPE_OPTIONS, RIGHT_TYPE_OPTIONS } from "@/app/lib/case-file-enums";
import { updateCaseFileDetailsFormAction } from "@/app/(protected)/case_files/[caseFileNumber]/actions";

type Props = {
  caseFileNumber: string;
  title: string | null;
  statusLabel: string;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  summary: string | null;
};

// Header of the case-file details card (identity: number, title, status) plus an
// inline editor for the user-managed classification fields. The "Éditer" button
// toggles the form; saving goes through a server action that revalidates the page
// so the read-only "Voir plus" section reflects the change.
export function CaseFileDetailsEditor({
  caseFileNumber,
  title,
  statusLabel,
  litigationType,
  rightType,
  summary,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [result, formAction, isPending] = useActionState(updateCaseFileDetailsFormAction, null);

  // Close the form once a save succeeds. Handling the new result during render
  // (guarded against re-runs) avoids a setState-in-effect cascade.
  const [handledResult, setHandledResult] = useState(result);
  if (result !== handledResult) {
    setHandledResult(result);
    if (result?.ok) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <div
        className={clsx(
          fr.cx("fr-mb-2w"),
          "flex flex-col items-start gap-4 lg:flex-row lg:items-start lg:justify-between",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={fr.cx("fr-icon-folder-2-line")}
            aria-hidden="true"
            style={{ color: "var(--text-action-high-blue-france)", marginTop: "0.25rem" }}
          />
          <div>
            <h2 className={fr.cx("fr-h4", "fr-mb-1v")}>
              {caseFileNumber + (title ? ` - ${title}` : "")}
            </h2>
            <Badge as="span" noIcon severity="info">
              {statusLabel}
            </Badge>
          </div>
        </div>

        <Button
          type="button"
          priority="secondary"
          size="small"
          iconId={isOpen ? "fr-icon-close-line" : "fr-icon-edit-line"}
          className={clsx("whitespace-nowrap")}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Fermer" : "Éditer les détails du dossier"}
        </Button>
      </div>

      {isOpen && (
        <form action={formAction} className={fr.cx("fr-mb-2w")}>
          <input type="hidden" name="caseFileNumber" value={caseFileNumber} />

          <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            <Select
              label="Type de contentieux"
              nativeSelectProps={{ name: "litigationType", defaultValue: litigationType ?? "" }}
              className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            >
              <option value="">—</option>
              {LITIGATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              label="Type de droit"
              nativeSelectProps={{ name: "rightType", defaultValue: rightType ?? "" }}
              className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            >
              <option value="">—</option>
              {RIGHT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Quelques mots caractérisant le dossier"
            nativeInputProps={{ name: "summary", defaultValue: summary ?? "" }}
            className={fr.cx("fr-mb-1w")}
          />

          <Button type="submit" disabled={isPending} iconId="fr-icon-save-line">
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>

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
      )}
    </>
  );
}
