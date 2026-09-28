import type { Prisma, PrismaClient } from "@prisma/client";
import {
  countComedDossiers,
  selectComedDecisions,
  type ComedDecision,
} from "./match-comed-decision";

const comedDecisionSelect = {
  encodedFileId: true,
  caseFileNumber: true,
  fileName: true,
  fileTypeLabel: true,
  eventCreationDate: true,
  dahliaNameNormalized: true,
  fileNameNormalized: true,
  caseFile: { select: { title: true } },
} satisfies Prisma.AttachedFileSelect;

// Load every attached file with its case file, then keep the COMED decisions.
// Name matching stays in JS (see match-comed-decision); Postgres only supplies
// the rows and the accent-folded names.
export async function findComedDecisions(prisma: PrismaClient): Promise<ComedDecision[]> {
  const files = await prisma.attachedFile.findMany({
    select: comedDecisionSelect,
    orderBy: [{ caseFileNumber: "asc" }, { eventCreationDate: "asc" }],
  });
  return selectComedDecisions(files);
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
