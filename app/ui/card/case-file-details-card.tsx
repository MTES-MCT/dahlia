import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileIdentity } from "@/app/ui/case-file/case-file-identity";
import { CaseFileTelerecoursSync } from "@/app/ui/case-file/case-file-telerecours-sync";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
};

// Sticky header of the case-file page: title, Télérecours title, status and the
// Télérecours sync notice. Qualification and comments are edited from the
// synthèse tab.
export function CaseFileDetailsCard({ caseFile }: Props) {
  return (
    <section
      className={clsx(
        fr.cx("fr-p-1w", "fr-mb-3w"),
        "shrink-0",
        "sticky",
        "top-0",
        "z-10",
        "bg-(--background-default-grey)",
      )}
    >
      <CaseFileIdentity
        displayName={getCaseFileDisplayName(caseFile)}
        title={caseFile.title}
        statusLabel={caseFile.lastStatus.label}
        name={{ kind: "heading" }}
        footer={
          <CaseFileTelerecoursSync
            jurisdictionCode={caseFile.jurisdictionCode}
            caseFileNumber={caseFile.caseFileNumber}
            telerecoursSyncAt={caseFile.telerecoursSyncAt}
          />
        }
      />
    </section>
  );
}
