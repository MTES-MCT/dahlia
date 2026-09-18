import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import { toCaseFileTagViews } from "@/app/lib/case-file-tags";
import { type CaseFileDashboardRow } from "@/app/lib/case-files-dashboard-columns";
import { CaseFileIdentity } from "@/app/ui/case-file/case-file-identity";

type Props = {
  caseFile: CaseFileDashboardRow;
  href: string;
};

export function CaseFileDossierCell({ caseFile, href }: Props) {
  return (
    <CaseFileIdentity
      displayName={getCaseFileDisplayName(caseFile)}
      title={caseFile.title}
      statusLabel={caseFile.lastStatus.label}
      tags={toCaseFileTagViews(caseFile.caseFileTags)}
      name={{ kind: "link", href }}
    />
  );
}
