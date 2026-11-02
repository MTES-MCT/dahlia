import type { Prisma, PrismaClient } from "@prisma/client";
import {
  countComedDossiers,
  selectComedDecisions,
  type ComedDecision,
} from "./match-comed-decision";

const comedDecisionSelect = {
  encodedFileId: true,
  jurisdictionCode: true,
  caseFileNumber: true,
  fileName: true,
  fileTypeLabel: true,
  eventCreationDate: true,
  dahliaNameNormalized: true,
  fileNameNormalized: true,
} satisfies Prisma.AttachedFileSelect;

// Prisma binds one parameter per parent row when a relation is selected.
// Postgres accepts at most 32767 parameters, and attached_files is larger
// than that, so the case-file title is loaded afterwards, only for matches.
const CASE_FILE_TITLE_BATCH = 10_000;

function caseFileTitleKey(jurisdictionCode: string, caseFileNumber: string): string {
  return `${jurisdictionCode}\0${caseFileNumber}`;
}

async function loadCaseFileTitles(
  prisma: PrismaClient,
  decisions: readonly { jurisdictionCode: string; caseFileNumber: string }[],
): Promise<Map<string, string | null>> {
  const numbersByCourt = new Map<string, Set<string>>();
  for (const decision of decisions) {
    const numbers = numbersByCourt.get(decision.jurisdictionCode) ?? new Set<string>();
    numbers.add(decision.caseFileNumber);
    numbersByCourt.set(decision.jurisdictionCode, numbers);
  }

  const titles = new Map<string, string | null>();
  for (const [jurisdictionCode, numbers] of numbersByCourt) {
    const caseFileNumbers = [...numbers];
    for (let offset = 0; offset < caseFileNumbers.length; offset += CASE_FILE_TITLE_BATCH) {
      const batch = caseFileNumbers.slice(offset, offset + CASE_FILE_TITLE_BATCH);
      const rows = await prisma.caseFile.findMany({
        where: { jurisdictionCode, caseFileNumber: { in: batch } },
        select: { jurisdictionCode: true, caseFileNumber: true, title: true },
      });
      for (const row of rows) {
        titles.set(caseFileTitleKey(row.jurisdictionCode, row.caseFileNumber), row.title);
      }
    }
  }
  return titles;
}

// Load every attached file, then keep the COMED decisions.
// Name matching stays in JS (see match-comed-decision); Postgres only supplies
// the rows and the accent-folded names.
export async function findComedDecisions(prisma: PrismaClient): Promise<ComedDecision[]> {
  const files = await prisma.attachedFile.findMany({
    select: comedDecisionSelect,
    orderBy: [{ caseFileNumber: "asc" }, { jurisdictionCode: "asc" }, { eventCreationDate: "asc" }],
  });
  const decisions = selectComedDecisions(
    files.map((file) => ({ ...file, caseFile: { title: null } })),
  );
  const titles = await loadCaseFileTitles(prisma, decisions);
  return decisions.map((decision) => ({
    ...decision,
    caseFileTitle:
      titles.get(caseFileTitleKey(decision.jurisdictionCode, decision.caseFileNumber)) ?? null,
  }));
}

export async function countUniqueDossiers(prisma: PrismaClient): Promise<number> {
  return await prisma.caseFile.count();
}

export function logComedDecisionStats(
  decisions: readonly ComedDecision[],
  nb_dossiers: number,
): void {
  const certain = decisions.filter((decision) => decision.verdict === "certain").length;
  const probable = decisions.length - certain;
  console.log("--------------------------------------------------");
  console.log("DÉCISIONS COMED");
  console.log(`  - pièces : ${decisions.length} (certain : ${certain}, probable : ${probable})`);
  console.log(`  - dossiers : ${countComedDossiers(decisions)} / ${nb_dossiers}`);
  console.log("--------------------------------------------------");
}
