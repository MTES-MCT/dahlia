import type { CaseFileActorWithRelations, CaseFileWithActors } from "@/app/lib/case-file-actors";
import type { LitigationType, Prisma, RightType } from "@prisma/client";

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

type ActorNamesFixture = {
  firstName?: string | null;
  lastName?: string | null;
  legalPersonName?: string | null;
  actorType?: ActorFixture["actorType"];
};

export function caseFileActorsFixture(
  options: {
    claimant?: ActorNamesFixture | null;
    defender?: ActorNamesFixture | null;
  } = {},
): CaseFileActorWithRelations[] {
  const actors: CaseFileActorWithRelations[] = [];
  const claimant =
    options.claimant === undefined ? { firstName: "Jean", lastName: "Dupont" } : options.claimant;

  if (claimant) {
    actors.push(
      caseFileActorFixture({
        actorId: 1,
        isMainClaimant: true,
        isMainDefender: false,
        actor: actorFixture({
          id: 1,
          firstName: claimant.firstName ?? null,
          lastName: claimant.lastName ?? null,
          actorType: claimant.actorType ?? "NATURAL_PERSON",
          legalPersonName: claimant.legalPersonName ?? null,
        }),
      }),
    );
  }

  if (options.defender) {
    actors.push(
      caseFileActorFixture({
        actorId: 2,
        qualityCode: "D",
        isMainClaimant: false,
        isMainDefender: true,
        actor: actorFixture({
          id: 2,
          firstName: options.defender.firstName ?? null,
          lastName: options.defender.lastName ?? null,
          actorType: options.defender.actorType ?? "NATURAL_PERSON",
          legalPersonName: options.defender.legalPersonName ?? null,
        }),
        quality: { code: "D", name: "Défendeur" },
      }),
    );
  }

  return actors;
}

export function mainClaimantCaseFileActors(
  claimant: { firstName?: string | null; lastName?: string | null } | null = {
    firstName: "Jean",
    lastName: "Dupont",
  },
): CaseFileActorWithRelations[] {
  return caseFileActorsFixture({ claimant });
}

type CaseFileActorFixtureOptions = Parameters<typeof caseFileActorsFixture>[0];

export type CaseFileWithActorFixture = {
  caseFileNumber: string;
  title: string | null;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  summary: string | null;
} & CaseFileWithActors;

export function caseFileWithActor(
  overrides: Partial<CaseFileWithActorFixture> = {},
  actors: CaseFileActorFixtureOptions = {},
): CaseFileWithActorFixture {
  const { caseFileActors, ...rest } = overrides;

  return {
    caseFileNumber: "TA069-2026-001",
    title: "Requête DALO",
    litigationType: "INJONCTION",
    rightType: "DALO",
    summary: "Urgence familiale",
    caseFileActors: caseFileActors ?? caseFileActorsFixture(actors),
    ...rest,
  };
}
