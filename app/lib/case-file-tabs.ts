export type CaseFileTabId = "pieces" | "historique" | "debug";

const CASE_FILE_TAB_IDS: CaseFileTabId[] = ["pieces", "historique", "debug"];

export type CaseFileSearchParams = Record<string, string | string[] | undefined>;

export function isDebugTabEnabled(searchParams: CaseFileSearchParams): boolean {
  return searchParams.debug !== undefined;
}

export function parseCaseFileTab(
  tabParam: string | string[] | undefined,
  searchParams?: CaseFileSearchParams,
): CaseFileTabId {
  const tab = typeof tabParam === "string" ? tabParam : undefined;
  const debugEnabled = searchParams ? isDebugTabEnabled(searchParams) : false;

  if (tab === "debug" && !debugEnabled) {
    return "pieces";
  }

  return CASE_FILE_TAB_IDS.includes(tab as CaseFileTabId) ? (tab as CaseFileTabId) : "pieces";
}
