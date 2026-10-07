import { PrismaClient } from "@prisma/client";
import { Actor, CaseFile } from "../telerecours/types";
import { anonymizeActor } from "../anonymize";
import { upsertCaseFileActorLink } from "./upsert-case-file-actors";
import { upsertHearingWithConclusion } from "./upsert-hearing";
import { upsertLegalEntityDivision } from "./upsert-legal-entity-division";
import type { ResolvedJurisdiction } from "./upsert-jurisdiction";

// The Prisma client is passed in so that this module can be reused both by the
// standalone scraping script (its own `new PrismaClient`) and by the webapp
// (the `@/app/lib/prisma` singleton).

export async function upsertActor(
  prisma: PrismaClient,
  jurisdictionCode: string,
  actor: Actor,
  anonymize: boolean = false,
): Promise<void> {
  if (anonymize) {
    actor = anonymizeActor(actor);
  }
  const data = {
    firstName: actor.firstName,
    lastName: actor.lastName,
    lastFirstName: actor.lastFirstName,
    firstLastName: actor.firstLastName,
    legalPersonName: actor.legalPersonName,
    legalEntityName: actor.legalEntityName,
    legalEntityId: actor.legalEntityId,
    actorType: actor.actorType as "LEGAL_PERSON" | "NATURAL_PERSON",
  };
  await prisma.actor.upsert({
    where: { jurisdictionCode_id: { jurisdictionCode, id: actor.id } },
    update: data,
    create: { jurisdictionCode, id: actor.id, ...data },
  });
}

// Upsert the base CaseFile and its directly-referenced entities (qualities,
// division, urgency, status, last hearing/conclusion, case-file actors) from a
// list-view payload. Returns false (and skips) when a required field is absent.
// `jurisdiction` is the Jurisdiction the scrape ran against (see
// upsertJurisdiction): its court code is part of the case-file key, its id tags
// the case file.
export async function upsertCaseFile(
  prisma: PrismaClient,
  caseFile: CaseFile,
  anonymize: boolean,
  jurisdiction: ResolvedJurisdiction,
): Promise<boolean> {
  const { jurisdictionCode, id: jurisdictionId } = jurisdiction;
  const key = { jurisdictionCode, caseFileNumber: caseFile.caseFileNumber };
  const missingFields: string[] = [];
  if (!caseFile.lastStatus) missingFields.push("lastStatus");
  if (!caseFile.mainClaimant) missingFields.push("mainClaimant");
  if (missingFields.length > 0 || !caseFile.lastStatus || !caseFile.mainClaimant) {
    console.warn(
      `⚠ Skipping case file ${caseFile.caseFileNumber}: missing required field(s) ${missingFields.join(", ")}`,
    );
    return false;
  }

  // Absent division is stored as null rather than skipping the case file.
  const assignedToLegalEntityDivisionId = caseFile.assignedToLegalEntityDivision?.id ?? null;
  if (caseFile.assignedToLegalEntityDivision) {
    await upsertLegalEntityDivision(prisma, caseFile.assignedToLegalEntityDivision);
  }

  if (caseFile.urgency) {
    await prisma.urgency.upsert({
      where: { id: caseFile.urgency.id },
      update: {
        key: caseFile.urgency.key,
        description: caseFile.urgency.description,
        colorHexadecimalCode: caseFile.urgency.colorHexadecimalCode,
      },
      create: {
        id: caseFile.urgency.id,
        key: caseFile.urgency.key,
        description: caseFile.urgency.description,
        colorHexadecimalCode: caseFile.urgency.colorHexadecimalCode,
      },
    });
  }

  await prisma.status.upsert({
    where: { id: caseFile.lastStatus.id },
    update: {
      label: caseFile.lastStatus.label,
      category: caseFile.lastStatus.category,
      groupId: caseFile.lastStatus.groupId,
    },
    create: {
      id: caseFile.lastStatus.id,
      label: caseFile.lastStatus.label,
      category: caseFile.lastStatus.category,
      groupId: caseFile.lastStatus.groupId,
    },
  });

  if (caseFile.lastHearing) {
    await upsertHearingWithConclusion(prisma, jurisdictionCode, caseFile.lastHearing);
  }

  // A case file number is unique within a court. Two Dahlia instances of the
  // same court (TA069 and TA069bis) can therefore rewrite each other's
  // jurisdictionId. Warn when an already-tagged row is about to move, and keep going.
  const existing = await prisma.caseFile.findUnique({
    where: { jurisdictionCode_caseFileNumber: key },
    select: { jurisdictionId: true },
  });
  if (existing?.jurisdictionId != null && existing.jurisdictionId !== jurisdictionId) {
    console.warn(
      `⚠ Case file ${caseFile.caseFileNumber}: jurisdictionId changed from ${existing.jurisdictionId} to ${jurisdictionId}`,
    );
  }

  await prisma.caseFile.upsert({
    where: { jurisdictionCode_caseFileNumber: key },
    update: {
      // The case file was returned by Telerecours, so it is not deleted: clear
      // any previous soft-delete flag (a case file that reappears comes back).
      isDeleted: false,
      deletedAt: null,
      procedureState: caseFile.procedureState,
      assignedToLegalEntityDivisionId,
      jurisdictionId,
      urgencyId: caseFile.urgency?.id,
      lastStatusId: caseFile.lastStatus.id,
      lastStatusDate: new Date(caseFile.lastStatus.statusDate),
      lastHearingId: caseFile.lastHearing?.hearingId,
      lastHearingConvocationDate: caseFile.lastHearing
        ? new Date(caseFile.lastHearing.convocationDate)
        : null,
    },
    create: {
      ...key,
      procedureState: caseFile.procedureState,
      assignedToLegalEntityDivisionId,
      jurisdictionId,
      urgencyId: caseFile.urgency?.id,
      lastStatusId: caseFile.lastStatus.id,
      lastStatusDate: new Date(caseFile.lastStatus.statusDate),
      lastHearingId: caseFile.lastHearing?.hearingId,
      lastHearingConvocationDate: caseFile.lastHearing
        ? new Date(caseFile.lastHearing.convocationDate)
        : null,
    },
  });

  if (caseFile.lastHearing) {
    await prisma.caseFileHearing.upsert({
      where: {
        jurisdictionCode_caseFileNumber_hearingId: {
          ...key,
          hearingId: caseFile.lastHearing.hearingId,
        },
      },
      update: {},
      create: {
        ...key,
        hearingId: caseFile.lastHearing.hearingId,
      },
    });
  }

  await upsertCaseFileActorLink(
    prisma,
    key,
    caseFile.mainClaimant,
    { isMainClaimant: true, isMainDefender: false },
    anonymize,
  );
  if (caseFile.mainDefender) {
    await upsertCaseFileActorLink(
      prisma,
      key,
      caseFile.mainDefender,
      { isMainClaimant: false, isMainDefender: true },
      anonymize,
    );
  }

  return true;
}
