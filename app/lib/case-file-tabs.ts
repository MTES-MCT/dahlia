export type CaseFileTabId = "pieces" | "historique" | "debug";

const CASE_FILE_TAB_IDS: CaseFileTabId[] = ["pieces", "historique", "debug"];

export function parseCaseFileTab(
  tabParam: string | string[] | undefined,
): CaseFileTabId {
  const tab = typeof tabParam === "string" ? tabParam : undefined;
  return CASE_FILE_TAB_IDS.includes(tab as CaseFileTabId)
    ? (tab as CaseFileTabId)
    : "pieces";
}
