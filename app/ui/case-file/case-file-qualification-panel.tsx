"use client";

import { Fragment, useActionState, useId, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import type { LitigationType, RightType } from "@prisma/client";
import {
  LITIGATION_TYPE_OPTIONS,
  PRODUCTION_DEADLINE_TYPE_LABELS,
  RIGHT_TYPE_OPTIONS,
  RIGHT_TYPE_UNDEFINED_VALUE,
  UNDER_INSTRUCTION_STATUS_LABEL,
  litigationTypeLabel,
  rightTypeLabel,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import { formatDateFr, formatDateInputValue } from "@/app/lib/case-file-format";
import { type QualificationReviewState } from "@/app/lib/case-file-qualification";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { CaseFileTagList } from "@/app/ui/case-file/case-file-identity";
import { CollapsiblePanel } from "@/app/ui/panel/collapsible-panel";
import { ProductionDeadlineFields } from "@/app/ui/form/production-deadline-fields";
import { TagPicker } from "@/app/ui/form/tag-picker";
import { validateCaseFileQualificationFormAction } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions";

export type CaseFileQualificationPanelProps = {
  jurisdictionCode: string;
  caseFileNumber: string;
  statusLabel: string;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  comDaloNumber: string | null;
  comedDecisionDate: Date | null;
  productionDeadlineType: ProductionDeadlineType | null;
  productionDeadlineDate: Date | null;
  tags: CaseFileTagView[];
  availableTags: CaseFileTagView[];
  reviewState: QualificationReviewState;
  // Formatted on the server, in the court's time zone.
  validatedAtLabel: string;
};

const SAVE_HINT =
  "En enregistrant, vous confirmez avoir vérifié les informations proposées automatiquement.";

function QualificationSummary({
  litigationType,
  rightType,
  comDaloNumber,
  comedDecisionDate,
  productionDeadlineType,
  productionDeadlineDate,
  tags,
}: Pick<
  CaseFileQualificationPanelProps,
  | "litigationType"
  | "rightType"
  | "comDaloNumber"
  | "comedDecisionDate"
  | "productionDeadlineType"
  | "productionDeadlineDate"
  | "tags"
>) {
  const litigation = litigationTypeLabel(litigationType);
  const right = rightTypeLabel(rightType);
  const parts: { key: string; content: React.ReactNode }[] = [];
  if (litigation) {
    parts.push({
      key: "litigation",
      content: <b className={clsx("text-(--text-title-grey)")}>{litigation}</b>,
    });
  }
  if (right) parts.push({ key: "right", content: right });
  if (comDaloNumber) parts.push({ key: "comdalo", content: `ComDalo n° ${comDaloNumber}` });
  if (comedDecisionDate) {
    parts.push({ key: "comed", content: `COMED du ${formatDateFr(comedDecisionDate)}` });
  }
  if (productionDeadlineType) {
    const deadlineDate = formatDateFr(productionDeadlineDate);
    parts.push({
      key: "deadline",
      content: [PRODUCTION_DEADLINE_TYPE_LABELS[productionDeadlineType], deadlineDate]
        .filter(Boolean)
        .join(" : "),
    });
  }

  return (
    <>
      {parts.length > 0 && (
        <p className={fr.cx("fr-mb-0")}>
          {parts.map((part, index) => (
            <Fragment key={part.key}>
              {index > 0 && " · "}
              <span>{part.content}</span>
            </Fragment>
          ))}
        </p>
      )}
      <CaseFileTagList tags={tags} />
    </>
  );
}

// "Qualification du dossier" block of the synthèse tab. Saving while a review is
// pending stamps the validation date (see validateCaseFileQualificationFormAction),
// which clears the classifier warning; otherwise it only saves the fields.
export function CaseFileQualificationPanel(props: CaseFileQualificationPanelProps) {
  const {
    jurisdictionCode,
    caseFileNumber,
    statusLabel,
    litigationType,
    rightType,
    comDaloNumber,
    comedDecisionDate,
    productionDeadlineType,
    productionDeadlineDate,
    tags,
    availableTags,
    reviewState,
    validatedAtLabel,
  } = props;
  const [result, formAction, isPending] = useActionState(
    validateCaseFileQualificationFormAction,
    null,
  );
  const formId = useId();
  const isToReview = reviewState === "toReview";

  // The success notice is a feedback on the save the agent just made, not a
  // persistent state: it only follows a save that settled a pending review, and
  // a page reload drops it. Whether a review was pending is captured on submit,
  // before the revalidated props report the case file as validated.
  const [submittedWhileToReview, setSubmittedWhileToReview] = useState(false);
  const [showValidated, setShowValidated] = useState(false);
  const [handledResult, setHandledResult] = useState(result);
  if (result !== handledResult) {
    setHandledResult(result);
    setShowValidated(Boolean(result?.ok) && submittedWhileToReview);
  }

  // Remount the form when the saved values change, so uncontrolled fields show
  // what is now stored.
  const formKey = [
    litigationType ?? "",
    rightType ?? RIGHT_TYPE_UNDEFINED_VALUE,
    comDaloNumber ?? "",
    formatDateInputValue(comedDecisionDate),
    productionDeadlineType ?? "",
    formatDateInputValue(productionDeadlineDate),
    tags.map((tag) => tag.id).join(","),
  ].join("\0");

  const banner =
    reviewState === "toReview" ? (
      <Alert
        severity="warning"
        small
        description={
          <>
            Données générées automatiquement : vérification par un agent de l’État indispensable
            <span className={clsx("block", "mt-2")}>
              <Button
                priority="secondary"
                size="small"
                type="submit"
                disabled={isPending}
                nativeButtonProps={{ form: formId }}
              >
                Valider la qualification du dossier
              </Button>
            </span>
          </>
        }
      />
    ) : showValidated && reviewState === "validated" ? (
      <Alert
        severity="success"
        small
        description={`Qualification revue et validée le ${validatedAtLabel}`}
      />
    ) : null;

  return (
    <CollapsiblePanel
      title="Qualification du dossier"
      openLabel="Afficher et éditer"
      defaultOpen={isToReview}
      banner={banner}
      summary={<QualificationSummary {...props} />}
    >
      <form
        key={formKey}
        id={formId}
        action={formAction}
        onSubmit={() => setSubmittedWhileToReview(isToReview)}
      >
        <input type="hidden" name="jurisdictionCode" value={jurisdictionCode} />
        <input type="hidden" name="caseFileNumber" value={caseFileNumber} />

        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          <Select
            label="Type de contentieux"
            className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            nativeSelectProps={{ name: "litigationType", defaultValue: litigationType ?? "" }}
          >
            <option value=""></option>
            {LITIGATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            label="Droit opposable"
            className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            nativeSelectProps={{
              name: "rightType",
              defaultValue: rightType ?? RIGHT_TYPE_UNDEFINED_VALUE,
            }}
          >
            {/* "Non défini" is the empty option. */}
            <option value={RIGHT_TYPE_UNDEFINED_VALUE}></option>
            {RIGHT_TYPE_OPTIONS.filter((option) => option.value !== RIGHT_TYPE_UNDEFINED_VALUE).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </Select>

          <Input
            label="Numéro ComDalo"
            className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            nativeInputProps={{
              name: "comDaloNumber",
              defaultValue: comDaloNumber ?? "",
              maxLength: 64,
            }}
          />

          <Input
            label="Date de la décision de la COMED"
            className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-1w")}
            nativeInputProps={{
              type: "date",
              name: "comedDecisionDate",
              defaultValue: formatDateInputValue(comedDecisionDate),
            }}
          />
        </div>

        <TagPicker availableTags={availableTags} defaultSelectedIds={tags.map((tag) => tag.id)} />

        {statusLabel === UNDER_INSTRUCTION_STATUS_LABEL && (
          <ProductionDeadlineFields
            productionDeadlineType={productionDeadlineType}
            productionDeadlineDate={productionDeadlineDate}
          />
        )}

        <div className={fr.cx("fr-mt-2w")}>
          <Button type="submit" disabled={isPending} iconId="fr-icon-save-line">
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          {isToReview && (
            <p className={fr.cx("fr-hint-text", "fr-mt-1w", "fr-mb-0")}>{SAVE_HINT}</p>
          )}
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
