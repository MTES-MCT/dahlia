import type { CaseFileKey } from "@/data/persistence/case-file-key";

export type { CaseFileKey };

// URL of a case file page: /case_files/<jurisdictionCode>/<caseFileNumber>,
// optionally followed by a sub-path (e.g. "/pieces") or a query string.
export function caseFileHref(key: CaseFileKey, suffix = ""): string {
  return (
    `/case_files/${encodeURIComponent(key.jurisdictionCode)}` +
    `/${encodeURIComponent(key.caseFileNumber)}${suffix}`
  );
}

// Decode the [jurisdictionCode]/[caseFileNumber] route params.
export function caseFileKeyFromParams(params: {
  jurisdictionCode: string;
  caseFileNumber: string;
}): CaseFileKey {
  return {
    jurisdictionCode: decodeURIComponent(params.jurisdictionCode),
    caseFileNumber: decodeURIComponent(params.caseFileNumber),
  };
}

// Prisma compound-unique selector of a case file.
export function caseFileUniqueWhere(key: CaseFileKey) {
  return {
    jurisdictionCode_caseFileNumber: {
      jurisdictionCode: key.jurisdictionCode,
      caseFileNumber: key.caseFileNumber,
    },
  };
}
