import type { CaseFileActorWithRelations } from "@/app/lib/case-file-actors";
import type { Prisma } from "@prisma/client";

type ActorFixture = Prisma.ActorGetPayload<object>;

export function actorFixture(overrides: Partial<ActorFixture> = {}): ActorFixture {
  return {
    id: 1,
    firstName: "Jean",
    lastName: "Dupont",
    lastFirstName: null,
    firstLastName: null,
    legalPersonName: null,
    legalEntityName: null,
    legalEntityId: null,
    actorType: "NATURAL_PERSON",
    displayName: null,
    displayNameNormalized: null,
    ...overrides,
  };
}

export function caseFileActorFixture(
  overrides: Partial<CaseFileActorWithRelations> = {},
): CaseFileActorWithRelations {
  const actorId = overrides.actorId ?? overrides.actor?.id ?? 1;
  const caseFileNumber = overrides.caseFileNumber ?? "TA069-2026-001";

  return {
    caseFileNumber,
    actorId,
    qualityCode: "R",
    isMainClaimant: true,
    isMainDefender: false,
    actor: actorFixture({ id: actorId, ...overrides.actor }),
    quality: { code: "R", name: "Requérant" },
    ...overrides,
  };
}

export function mainClaimantCaseFileActors(
  claimant: { firstName?: string | null; lastName?: string | null } | null = {
    firstName: "Jean",
    lastName: "Dupont",
  },
): CaseFileActorWithRelations[] {
  if (!claimant) return [];

  return [
    caseFileActorFixture({
      actor: actorFixture({
        firstName: claimant.firstName ?? null,
        lastName: claimant.lastName ?? null,
      }),
    }),
  ];
}
