import { type Prisma } from "@prisma/client";

export const CASE_FILE_ACTOR_INCLUDE = {
  actor: true,
  quality: true,
} as const satisfies Prisma.CaseFileActorInclude;

export type CaseFileActorWithRelations = Prisma.CaseFileActorGetPayload<{
  include: typeof CASE_FILE_ACTOR_INCLUDE;
}>;

export type CaseFileWithActors = {
  caseFileActors: CaseFileActorWithRelations[];
};

export function getMainClaimantActor(caseFile: CaseFileWithActors) {
  return caseFile.caseFileActors.find((link) => link.isMainClaimant)?.actor ?? null;
}

export function getMainDefenderActor(caseFile: CaseFileWithActors) {
  return caseFile.caseFileActors.find((link) => link.isMainDefender)?.actor ?? null;
}

export function getOtherCaseFileActors(caseFile: CaseFileWithActors) {
  return caseFile.caseFileActors.filter((link) => !link.isMainClaimant && !link.isMainDefender);
}

export function buildMainActorSearchFilter(
  role: "isMainClaimant" | "isMainDefender",
  normalizedWord: string,
): Prisma.CaseFileWhereInput {
  return {
    caseFileActors: {
      some: {
        [role]: true,
        actor: { displayNameNormalized: { contains: normalizedWord } },
      },
    },
  };
}
