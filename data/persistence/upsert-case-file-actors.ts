import { PrismaClient } from "@prisma/client";
import { Actor, CaseFileActorDto } from "../telerecours/types";
import { anonymizeActor } from "../anonymize";
import { upsertActor } from "./upsert-case-file";

type CaseFileActorRole = {
  isMainClaimant: boolean;
  isMainDefender: boolean;
};

async function upsertQuality(
  prisma: PrismaClient,
  quality: { code: string; name: string } | undefined,
  fallbackCode: string,
): Promise<string> {
  const code = quality?.code ?? fallbackCode;
  if (quality) {
    await prisma.quality.upsert({
      where: { code: quality.code },
      update: { name: quality.name },
      create: { code: quality.code, name: quality.name },
    });
  }
  return code;
}

export async function upsertCaseFileActorLink(
  prisma: PrismaClient,
  caseFileNumber: string,
  actor: Actor,
  role: CaseFileActorRole,
  anonymize: boolean,
): Promise<void> {
  if (anonymize) {
    actor = anonymizeActor(actor);
  }
  const qualityCode = await upsertQuality(prisma, actor.quality, "R");
  await upsertActor(prisma, actor, anonymize);
  await prisma.caseFileActor.upsert({
    where: {
      caseFileNumber_actorId: { caseFileNumber, actorId: actor.id },
    },
    update: {
      qualityCode,
      isMainClaimant: role.isMainClaimant,
      isMainDefender: role.isMainDefender,
    },
    create: {
      caseFileNumber,
      actorId: actor.id,
      qualityCode,
      isMainClaimant: role.isMainClaimant,
      isMainDefender: role.isMainDefender,
    },
  });
}

function collectActorsFromDto(
  actor: CaseFileActorDto,
  representationLinks: Array<{ representedActorId: number; representativeActorId: number }>,
): CaseFileActorDto[] {
  const collected = [actor];
  for (const representative of actor.representedBy ?? []) {
    representationLinks.push({
      representedActorId: actor.id,
      representativeActorId: representative.id,
    });
    collected.push(...collectActorsFromDto(representative, representationLinks));
  }
  return collected;
}

// Upsert all actors of a case file from /api/case-file/<id>/actors and reconcile
// links that disappeared since the previous scrape.
export async function upsertCaseFileActorsFromApi(
  prisma: PrismaClient,
  caseFileNumber: string,
  actors: CaseFileActorDto[],
  anonymize: boolean,
): Promise<void> {
  const representationLinks: Array<{
    representedActorId: number;
    representativeActorId: number;
  }> = [];
  const uniqueActors = new Map<number, CaseFileActorDto>();

  for (const actor of actors) {
    for (const item of collectActorsFromDto(actor, representationLinks)) {
      const existing = uniqueActors.get(item.id);
      uniqueActors.set(
        item.id,
        existing
          ? {
              ...item,
              isMainClaimant: existing.isMainClaimant || item.isMainClaimant,
              isMainDefender: existing.isMainDefender || item.isMainDefender,
            }
          : item,
      );
    }
  }

  for (const actor of uniqueActors.values()) {
    await upsertCaseFileActorLink(
      prisma,
      caseFileNumber,
      actor,
      {
        isMainClaimant: actor.isMainClaimant,
        isMainDefender: actor.isMainDefender,
      },
      anonymize,
    );
  }

  const actorIds = [...uniqueActors.keys()];
  await prisma.caseFileActor.deleteMany({
    where: {
      caseFileNumber,
      ...(actorIds.length > 0 ? { actorId: { notIn: actorIds } } : {}),
    },
  });

  await prisma.actorRepresentation.deleteMany({ where: { caseFileNumber } });
  for (const link of representationLinks) {
    await prisma.actorRepresentation.create({
      data: {
        caseFileNumber,
        representedActorId: link.representedActorId,
        representativeActorId: link.representativeActorId,
      },
    });
  }
}
