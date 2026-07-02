import { notFound } from "next/navigation";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileBreadcrumb } from "@/app/ui/breadcrumb/case-file-breadcrumb";
import { CaseFileDetailsCard } from "@/app/ui/card/case-file-details-card";
import { CaseFileTabs } from "@/app/ui/tabs/case-file-tabs";
import { parseCaseFileTab } from "@/app/lib/case-file-tabs";

type Props = {
  params: Promise<{ caseFileNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { caseFileNumber } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);
  const resolvedSearchParams = await searchParams;
  const tab = parseCaseFileTab(resolvedSearchParams.tab);

  const caseFile = await fetchCaseFileDetail(decodedCaseFileNumber);

  if (!caseFile) {
    notFound();
  }

  return (
    <>
      <CaseFileBreadcrumb caseFile={caseFile} searchParams={resolvedSearchParams} />

      <CaseFileDetailsCard caseFile={caseFile} />

      <CaseFileTabs caseFile={caseFile} tab={tab} searchParams={resolvedSearchParams} />
    </>
  );
}
