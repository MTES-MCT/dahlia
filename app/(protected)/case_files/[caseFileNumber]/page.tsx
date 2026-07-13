import { notFound } from "next/navigation";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileBreadcrumb } from "@/app/ui/breadcrumb/case-file-breadcrumb";
import { CaseFileDetailsCard } from "@/app/ui/card/case-file-details-card";
import { CaseFileTabs } from "@/app/ui/tabs/case-file-tabs";
import { parseCaseFileTab } from "@/app/lib/case-file-tabs";
import clsx from "clsx";
type Props = {
  params: Promise<{ caseFileNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { caseFileNumber } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);
  const resolvedSearchParams = await searchParams;
  const tab = parseCaseFileTab(resolvedSearchParams.tab, resolvedSearchParams);

  const caseFile = await fetchCaseFileDetail(decodedCaseFileNumber);

  if (!caseFile) {
    notFound();
  }

  // The pièces tab is a full-viewport workspace: the details card + tabs fill the
  // screen and the panel scrolls internally. Other tabs keep the natural page flow.
  const isPieces = tab === "pieces";

  return (
    <>
      <CaseFileBreadcrumb caseFile={caseFile} searchParams={resolvedSearchParams} />

      {/* Anchor target: navigating to this page with `#case-file-details` aligns
          the viewport to the top of this block (details card), scrolling the
          breadcrumb out of view. Kept off the sticky details card itself, since
          anchoring to a sticky element mis-computes the scroll target. */}
      <div
        id="case-file-details"
        className={clsx(
          "flex",
          "flex-col",
          isPieces ? clsx("h-screen", "min-h-0") : clsx("min-h-0", "flex-1"),
        )}
      >
        <CaseFileDetailsCard caseFile={caseFile} />

        <CaseFileTabs caseFile={caseFile} tab={tab} searchParams={resolvedSearchParams} />
      </div>
    </>
  );
}
