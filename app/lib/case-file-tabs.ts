export type CaseFileTabId = "synthese" | "historique" | "pieces" | "debug";

const CASE_FILE_TAB_IDS: CaseFileTabId[] = ["synthese", "historique", "pieces", "debug"];

export const DEFAULT_CASE_FILE_TAB: CaseFileTabId = "synthese";

// Query param selecting the pièce shown first in the pièces tab.
export const PIECE_PARAM = "piece";

// URL suffix opening the pièces tab on a given pièce.
export function pieceTabSuffix(encodedFileId: string): string {
  return `?${new URLSearchParams({ tab: "pieces", [PIECE_PARAM]: encodedFileId })}`;
}

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
    return DEFAULT_CASE_FILE_TAB;
  }

  return CASE_FILE_TAB_IDS.includes(tab as CaseFileTabId)
    ? (tab as CaseFileTabId)
    : DEFAULT_CASE_FILE_TAB;
}
