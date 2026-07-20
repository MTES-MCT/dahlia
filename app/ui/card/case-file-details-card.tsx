import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { formatDateFr, formatDateTimeFr, getActorDisplayName, getCaseFileDisplayName } from "@/app/lib/case-file-format";
import {
  getMainClaimantActor,
  getMainDefenderActor,
  getOtherCaseFileActors,
} from "@/app/lib/case-file-actors";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import {
  CaseFileDetailsHeader,
  CaseFileDetailsModal,
  type CaseFileDetailsEditorProps,
} from "@/app/ui/form/case-file-details-editor";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
};

export function CaseFileDetailsCard({ caseFile }: Props) {
  const editorProps: CaseFileDetailsEditorProps = {
    caseFileNumber: caseFile.caseFileNumber,
    title: caseFile.title,
    statusLabel: caseFile.lastStatus.label,
    litigationType: caseFile.litigationType,
    rightType: caseFile.rightType,
    summary: caseFile.summary,
    productionDeadlineType: caseFile.productionDeadlineType,
    productionDeadlineDate: caseFile.productionDeadlineDate,
    mainClaimantName: getActorDisplayName(getMainClaimantActor(caseFile)),
    mainDefenderName: getActorDisplayName(getMainDefenderActor(caseFile)),
    otherActors: getOtherCaseFileActors(caseFile).map((link) => ({
      actorId: link.actorId,
      qualityLabel: link.quality.name,
      name: getActorDisplayName(link.actor),
    })),
    depositDateLabel: formatDateFr(caseFile.depositDate),
    chamberName: caseFile.chamber?.name,
    decisionReadingDateLabel: formatDateTimeFr(caseFile.lastDecisionReading?.readingDate),
    decisionNature: caseFile.lastDecisionReading?.nature ?? null,
    decisionOperativePart: caseFile.lastDecisionReading?.operativePart ?? null,
  };

  return (
    <>
      <section
        className={clsx(
          fr.cx("fr-p-1w", "fr-mb-3w"),
          "shrink-0",
          "sticky",
          "top-0",
          "z-10",
          "bg-(--background-default-grey)",
          "border-0",
          "border-l-4",
          "border-solid",
          "border-l-(--border-active-blue-france)",
        )}
      >
        <CaseFileDetailsHeader
          displayName={getCaseFileDisplayName(caseFile)}
          title={editorProps.title}
          statusLabel={editorProps.statusLabel}
        />
      </section>

      {/* Rendered outside the sticky section so the modal backdrop covers the header. */}
      <CaseFileDetailsModal
        caseFileNumber={editorProps.caseFileNumber}
        statusLabel={editorProps.statusLabel}
        litigationType={editorProps.litigationType}
        rightType={editorProps.rightType}
        summary={editorProps.summary}
        productionDeadlineType={editorProps.productionDeadlineType}
        productionDeadlineDate={editorProps.productionDeadlineDate}
        mainClaimantName={editorProps.mainClaimantName}
        mainDefenderName={editorProps.mainDefenderName}
        otherActors={editorProps.otherActors}
        depositDateLabel={editorProps.depositDateLabel}
        chamberName={editorProps.chamberName}
        decisionReadingDateLabel={editorProps.decisionReadingDateLabel}
        decisionNature={editorProps.decisionNature}
        decisionOperativePart={editorProps.decisionOperativePart}
      />
    </>
  );
}
