"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import type { LitigationType, RightType } from "@prisma/client";
import {
  LITIGATION_TYPE_OPTIONS,
  PRODUCTION_DEADLINE_TYPE_OPTIONS,
  PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE,
  RIGHT_TYPE_OPTIONS,
  RIGHT_TYPE_UNDEFINED_VALUE,
  UNDER_INSTRUCTION_STATUS_LABEL,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import {
  formatDateInputValue,
  isDateInputBeforeToday,
  PRODUCTION_DEADLINE_DATE_IN_PAST_WARNING,
} from "@/app/lib/case-file-format";
import { updateCaseFileDetailsFormAction } from "@/app/(protected)/case_files/[caseFileNumber]/actions";

const caseFileDetailsModal = createModal({
  isOpenedByDefault: false,
  id: "case-file-details-modal",
});

export type CaseFileDetailsEditorProps = {
  caseFileNumber: string;
  title: string | null;
  statusLabel: string;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  summary: string | null;
  productionDeadlineType: ProductionDeadlineType | null;
  productionDeadlineDate: Date | null;
  mainClaimantName: string;
  mainDefenderName: string;
  otherActors: { actorId: number; qualityLabel: string; name: string }[];
  depositDateLabel: string;
  chamberName: string | undefined;
  // Last decision reading (Telerecours `lastDecisionReading`); absent on case
  // files where no decision has been read yet.
  decisionReadingDateLabel: string;
  decisionNature: string | null;
  decisionOperativePart: string | null;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fr.cx("fr-mb-2w")}>
      <span
        className={fr.cx("fr-text--xs", "fr-mb-0")}
        style={{ display: "block", color: "var(--text-mention-grey)" }}
      >
        {label}
      </span>
      <span className={fr.cx("fr-text--bold", "fr-mb-0")} style={{ display: "block" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function ProductionDeadlineFields({
  productionDeadlineType,
  productionDeadlineDate,
}: Pick<CaseFileDetailsEditorProps, "productionDeadlineType" | "productionDeadlineDate">) {
  const initialType = productionDeadlineType ?? PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE;
  const [selectedType, setSelectedType] = useState(initialType);
  const [dateValue, setDateValue] = useState(formatDateInputValue(productionDeadlineDate));
  const hasDeadlineType = selectedType !== PRODUCTION_DEADLINE_TYPE_UNDEFINED_VALUE;
  const dateWarning =
    hasDeadlineType && dateValue && isDateInputBeforeToday(dateValue)
      ? PRODUCTION_DEADLINE_DATE_IN_PAST_WARNING
      : null;

  return (
    <>
      <input type="hidden" name="hasProductionDeadlineFields" value="true" />

      <div
        className={clsx(
          fr.cx("fr-mb-1w"),
          "flex flex-wrap items-start justify-start gap-x-4 gap-y-2",
        )}
      >
        <RadioButtons
          legend="Échéance à produire"
          name="productionDeadlineType"
          orientation="horizontal"
          options={PRODUCTION_DEADLINE_TYPE_OPTIONS.map((option) => ({
            label: option.label,
            nativeInputProps: {
              value: option.value,
              defaultChecked: initialType === option.value,
              onChange: () => setSelectedType(option.value),
            },
          }))}
        />

        <Input
          label="Date limite de production"
          disabled={!hasDeadlineType}
          state={dateWarning ? "error" : "default"}
          stateRelatedMessage={dateWarning ?? undefined}
          nativeInputProps={{
            type: "date",
            name: "productionDeadlineDate",
            value: dateValue,
            onChange: (event) => setDateValue(event.currentTarget.value),
          }}
          className="shrink-0"
        />
      </div>
    </>
  );
}

// Sticky card header (display name, status) and trigger for the modal.
// Kept separate from the modal so the dialog backdrop is not clipped by the
// sticky stacking context.
export function CaseFileDetailsHeader({
  displayName,
  statusLabel,
}: {
  displayName: string;
  statusLabel: string;
}) {
  return (
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
          <h1 className={fr.cx("fr-h4", "fr-mb-1v")}>{displayName}</h1>
          <Badge as="span" noIcon severity="info">
            {statusLabel}
          </Badge>
        </div>
      </div>

      <Button
        priority="secondary"
        size="small"
        iconId="fr-icon-edit-line"
        className={clsx("whitespace-nowrap")}
        nativeButtonProps={{
          ...caseFileDetailsModal.buttonProps,
          type: "button",
        }}
      >
        Détails du dossier
      </Button>
    </div>
  );
}

// Modal editor for user-managed classification fields. Saving goes through a server
// action that revalidates the page so the card reflects the change.
export function CaseFileDetailsModal({
  caseFileNumber,
  statusLabel,
  litigationType,
  rightType,
  summary,
  productionDeadlineType,
  productionDeadlineDate,
  mainClaimantName,
  mainDefenderName,
  otherActors,
  depositDateLabel,
  chamberName,
  decisionReadingDateLabel,
  decisionNature,
  decisionOperativePart,
}: Omit<CaseFileDetailsEditorProps, "title">) {
  const [result, formAction, isPending] = useActionState(updateCaseFileDetailsFormAction, null);
  const showProductionDeadlineFields = statusLabel === UNDER_INSTRUCTION_STATUS_LABEL;
  const hasDecisionReading = Boolean(
    decisionReadingDateLabel || decisionNature || decisionOperativePart,
  );

  // Remount the form on each modal open so uncontrolled fields reset to the latest
  // caseFile values instead of keeping unsaved edits from a previous session.
  const [formOpenGeneration, setFormOpenGeneration] = useState(0);
  useIsModalOpen(caseFileDetailsModal, {
    onDisclose: () => {
      setFormOpenGeneration((generation) => generation + 1);
    },
  });
  const formKey = [
    formOpenGeneration,
    litigationType ?? "",
    rightType ?? RIGHT_TYPE_UNDEFINED_VALUE,
    summary ?? "",
    productionDeadlineType ?? "",
    formatDateInputValue(productionDeadlineDate),
  ].join("\0");

  // Close the modal once a save succeeds. Handling the new result during render
  // (guarded against re-runs) avoids a setState-in-effect cascade.
  const [handledResult, setHandledResult] = useState(result);
  if (result !== handledResult) {
    setHandledResult(result);
    if (result?.ok) {
      caseFileDetailsModal.close();
    }
  }

  return (
    <caseFileDetailsModal.Component
      title="&nbsp;Détails du dossier"
      iconId="fr-icon-folder-2-line"
      size="large"
    >
      <form key={formKey} action={formAction} className={fr.cx("fr-mb-3w")}>
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

          <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}>
            <RadioButtons
              legend="Droit opposable"
              name="rightType"
              orientation="horizontal"
              options={RIGHT_TYPE_OPTIONS.map((option) => ({
                label: option.label,
                nativeInputProps: {
                  value: option.value,
                  defaultChecked: (rightType ?? RIGHT_TYPE_UNDEFINED_VALUE) === option.value,
                },
              }))}
            />
          </div>
        </div>

        <Input
          label="Quelques mots caractérisant le dossier"
          nativeInputProps={{ name: "summary", defaultValue: summary ?? "" }}
        />

        {showProductionDeadlineFields && (
          <ProductionDeadlineFields
            productionDeadlineType={productionDeadlineType}
            productionDeadlineDate={productionDeadlineDate}
          />
        )}

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

      <h2 className={fr.cx("fr-h6", "fr-mb-2w")}>Informations Télérecours</h2>
      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <DetailRow label="Requérant" value={mainClaimantName} />
        <DetailRow label="Défendeur" value={mainDefenderName} />
        <DetailRow label="Date de réception" value={depositDateLabel} />
        <DetailRow label="Chambre" value={chamberName} />
      </div>

      {otherActors.length > 0 && (
        <>
          <h2 className={fr.cx("fr-h6", "fr-mb-2w")}>Autres acteurs</h2>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {otherActors.map((actor) => (
              <DetailRow
                key={actor.actorId}
                label={actor.qualityLabel}
                value={actor.name}
              />
            ))}
          </div>
        </>
      )}

      {hasDecisionReading && (
        <>
          <h2 className={fr.cx("fr-h6", "fr-mb-2w")}>Décision</h2>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <DetailRow
              label="Date et heure de la mise à disposition"
              value={decisionReadingDateLabel && `Le ${decisionReadingDateLabel}`}
            />
            <DetailRow label="Nature de la décision" value={decisionNature} />
            <div className="md:col-span-2">
              <DetailRow label="Dispositif" value={decisionOperativePart} />
            </div>
          </div>
        </>
      )}
    </caseFileDetailsModal.Component>
  );
}
