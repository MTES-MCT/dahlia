import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import clsx from "clsx";
import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileDashboardRow } from "@/app/lib/case-files-dashboard-columns";
import { statusBadgeAccentuationClassName } from "@/app/lib/status-badge-accentuation";

type Props = {
  caseFile: CaseFileDashboardRow;
  href: string;
};

export function CaseFileDossierCell({ caseFile, href }: Props) {
  const title = caseFile.title?.trim();

  return (
    <>
      <Link href={href}>{getCaseFileDisplayName(caseFile)}</Link>
      <div>
        {title ? (
          <span className={clsx(fr.cx("fr-mt-1v"), "text-(--text-mention-grey) italic")}>
            {title}
          </span>
        ) : null}
      </div>
      <div className={fr.cx("fr-mt-1v")}>
        <Badge
          as="span"
          noIcon
          className={fr.cx(statusBadgeAccentuationClassName(caseFile.lastStatus.label))}
        >
          {caseFile.lastStatus.label}
        </Badge>
      </div>
    </>
  );
}
