import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
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
    mainClaimantName: getActorDisplayName(caseFile.mainClaimant),
    mainDefenderName: getActorDisplayName(caseFile.mainDefender),
    depositDateLabel: formatDateFr(caseFile.depositDate),
    chamberName: caseFile.chamber?.name,
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
          caseFileNumber={editorProps.caseFileNumber}
          title={editorProps.title}
          statusLabel={editorProps.statusLabel}
        />
      </section>

      {/* Rendered outside the sticky section so the modal backdrop covers the header. */}
      <CaseFileDetailsModal
        caseFileNumber={editorProps.caseFileNumber}
        litigationType={editorProps.litigationType}
        rightType={editorProps.rightType}
        summary={editorProps.summary}
        mainClaimantName={editorProps.mainClaimantName}
        mainDefenderName={editorProps.mainDefenderName}
        depositDateLabel={editorProps.depositDateLabel}
        chamberName={editorProps.chamberName}
      />
    </>
  );
}
