export type CaseFileTabId = "pieces" | "historique" | "debug";

const CASE_FILE_TAB_IDS: CaseFileTabId[] = ["pieces", "historique", "debug"];

export type CaseFileSearchParams = Record<string, string | string[] | undefined>;

// Diagnostic dump of a case file. The query param only opts in; the caller must
// also be a validated administrator. Missing the role fails closed.
export function isDebugTabEnabled(searchParams: CaseFileSearchParams, isAdmin: boolean): boolean {
  return isAdmin && searchParams.debug !== undefined;
}

export function parseCaseFileTab(
  tabParam: string | string[] | undefined,
  searchParams?: CaseFileSearchParams,
  isAdmin = false,
): CaseFileTabId {
  const tab = typeof tabParam === "string" ? tabParam : undefined;
  const debugEnabled = searchParams ? isDebugTabEnabled(searchParams, isAdmin) : false;

  if (tab === "debug" && !debugEnabled) {
    return "pieces";
  }

  return CASE_FILE_TAB_IDS.includes(tab as CaseFileTabId) ? (tab as CaseFileTabId) : "pieces";
}
