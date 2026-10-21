import { CASE_FILE_ACTOR_INCLUDE } from "@/app/lib/case-file-actors";
import { getCaseFileDisplayName } from "@/app/lib/case-file-format";
import type { CaseFileKey } from "@/app/lib/case-file-key";
import {
  caseFileRelationScopeWhere,
  caseFileScopeWhere,
  getCurrentCaseFileScope,
  isJurisdictionInScope,
} from "@/app/lib/case-file-scope";
import { prisma } from "@/app/lib/prisma";

// A related case file the user may open, or only the fact that it exists: its
// title and display name carry the parties' names, which must not leak outside
// the user's scope. `displayName` is null when it would only repeat the number.
export type RelatedCaseFileLink =
  | { accessible: true; key: CaseFileKey; title: string | null; displayName: string | null }
  | { accessible: false; key: CaseFileKey };

const RELATED_CASE_FILE_SELECT = {
  jurisdictionCode: true,
  caseFileNumber: true,
  title: true,
  jurisdictionId: true,
  litigationType: true,
  rightType: true,
  caseFileActors: { include: CASE_FILE_ACTOR_INCLUDE },
} as const;

// Case files linked to `key`, in either direction: the scraper stores one row
// per reporting case file, so a link may only exist on the other side. Both
// queries require `key` itself to be in scope; the other side is only flagged.
export async function fetchRelatedCaseFiles(key: CaseFileKey): Promise<RelatedCaseFileLink[]> {
  const [scope, relationScope, caseFileScope] = await Promise.all([
    getCurrentCaseFileScope(),
    caseFileRelationScopeWhere(),
    caseFileScopeWhere(),
  ]);

  const [outgoing, incoming] = await Promise.all([
    prisma.relatedCaseFile.findMany({
      where: {
        jurisdictionCode: key.jurisdictionCode,
        caseFileNumber: key.caseFileNumber,
        ...relationScope,
      },
      select: { relatedCaseFile: { select: RELATED_CASE_FILE_SELECT } },
    }),
    prisma.relatedCaseFile.findMany({
      where: {
        jurisdictionCode: key.jurisdictionCode,
        relatedCaseFileNumber: key.caseFileNumber,
        relatedCaseFile: caseFileScope,
      },
      select: { caseFile: { select: RELATED_CASE_FILE_SELECT } },
    }),
  ]);

  const related = new Map(
    [...outgoing.map((row) => row.relatedCaseFile), ...incoming.map((row) => row.caseFile)].map(
      (caseFile) => [caseFile.caseFileNumber, caseFile],
    ),
  );

  return [...related.values()]
    .sort((a, b) => a.caseFileNumber.localeCompare(b.caseFileNumber))
    .map((caseFile) => {
      const relatedKey = {
        jurisdictionCode: caseFile.jurisdictionCode,
        caseFileNumber: caseFile.caseFileNumber,
      };
      if (!isJurisdictionInScope(scope, caseFile.jurisdictionId)) {
        return { accessible: false, key: relatedKey };
      }
      const displayName = getCaseFileDisplayName(caseFile);
      return {
        accessible: true,
        key: relatedKey,
        title: caseFile.title,
        displayName: displayName === caseFile.caseFileNumber ? null : displayName,
      };
    });
}
