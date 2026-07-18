import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { getCaseFileDisplayName, type CaseFileDisplayNameSource } from "@/app/lib/case-file-format";
import { type CaseFileWithActors } from "@/app/lib/case-file-actors";
import { buildBackParams, type CarriedSearchParams } from "@/app/lib/carried-search-params";

export type CaseFileForBreadcrumb = CaseFileDisplayNameSource & CaseFileWithActors;

type BreadcrumbSegment = {
  label: React.ReactNode;
  linkProps: { href: string };
};

type Props = {
  caseFile: CaseFileForBreadcrumb;
  searchParams: CarriedSearchParams;
  currentPageLabel?: string;
  trailingSegments?: BreadcrumbSegment[];
};

export function caseFileLabel(caseFile: CaseFileForBreadcrumb): string {
  return getCaseFileDisplayName(caseFile);
}

export function buildDashboardBreadcrumbSegment(
  searchParams: CarriedSearchParams,
): BreadcrumbSegment {
  const backParams = buildBackParams(searchParams);
  const queryString = backParams.toString();
  const backHref = `/case_files${queryString ? `?${queryString}` : ""}`;

  return {
    label: (
      <span className={fr.cx("fr-icon-arrow-go-back-line", "fr-link--icon-left")}>
        Tableau de bord
      </span>
    ),
    linkProps: { href: backHref },
  };
}

export function buildCaseFileBreadcrumbSegment(
  caseFile: CaseFileForBreadcrumb,
  searchParams: CarriedSearchParams,
): BreadcrumbSegment {
  const queryString = buildBackParams(searchParams).toString();
  const suffix = queryString ? `?${queryString}` : "";

  return {
    label: caseFileLabel(caseFile),
    linkProps: {
      href: `/case_files/${encodeURIComponent(caseFile.caseFileNumber)}${suffix}#case-file-details`,
    },
  };
}

export function CaseFileBreadcrumb({
  caseFile,
  searchParams,
  currentPageLabel,
  trailingSegments = [],
}: Props) {
  return (
    <Breadcrumb
      currentPageLabel={currentPageLabel ?? caseFileLabel(caseFile)}
      segments={[buildDashboardBreadcrumbSegment(searchParams), ...trailingSegments]}
      className={fr.cx("fr-mb-1w")}
    />
  );
}
