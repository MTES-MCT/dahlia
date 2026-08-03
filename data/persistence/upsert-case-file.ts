import { PrismaClient } from "@prisma/client";
import { Actor, CaseFile } from "../telerecours/types";
import { anonymizeActor } from "../anonymize";
import { upsertCaseFileActorLink } from "./upsert-case-file-actors";
import { upsertLegalEntityDivision } from "./upsert-legal-entity-division";

// The Prisma client is passed in so that this module can be reused both by the
// standalone scraping script (its own `new PrismaClient`) and by the webapp
// (the `@/app/lib/prisma` singleton).

export async function upsertActor(
  prisma: PrismaClient,
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
    where: { id: actor.id },
    update: data,
    create: { id: actor.id, ...data },
  });
}

// Upsert the base CaseFile and its directly-referenced entities (qualities,
// division, urgency, status, last hearing/conclusion, case-file actors) from a
// list-view payload. Returns false (and skips) when a required field is absent.
// `jurisdictionId` is the Jurisdiction the scrape ran against (see
// upsertJurisdiction); when omitted the column is left untouched.
export async function upsertCaseFile(
  prisma: PrismaClient,
  caseFile: CaseFile,
  anonymize: boolean = false,
  jurisdictionId?: number,
): Promise<boolean> {
  const missingFields: string[] = [];
  if (!caseFile.assignedToLegalEntityDivision) missingFields.push("assignedToLegalEntityDivision");
  if (!caseFile.lastStatus) missingFields.push("lastStatus");
  if (!caseFile.mainClaimant) missingFields.push("mainClaimant");
  if (
    missingFields.length > 0 ||
    !caseFile.assignedToLegalEntityDivision ||
    !caseFile.lastStatus ||
    !caseFile.mainClaimant
  ) {
    console.warn(
      `⚠ Skipping case file ${caseFile.caseFileNumber}: missing required field(s) ${missingFields.join(", ")}`,
    );
    return false;
  }

  await upsertLegalEntityDivision(prisma, caseFile.assignedToLegalEntityDivision);

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

  if (caseFile.lastHearing?.lastConclusion?.conclusionOperativePart) {
    await prisma.conclusionOperativePart.upsert({
      where: { id: caseFile.lastHearing.lastConclusion.conclusionOperativePart.id },
      update: { label: caseFile.lastHearing.lastConclusion.conclusionOperativePart.label },
      create: {
        id: caseFile.lastHearing.lastConclusion.conclusionOperativePart.id,
        label: caseFile.lastHearing.lastConclusion.conclusionOperativePart.label,
      },
    });
  }

  const lastConclusion = caseFile.lastHearing?.lastConclusion;
  if (lastConclusion) {
    if (lastConclusion.id == null || lastConclusion.publicationDate == null) {
      console.warn(
        `⚠ Skipping Conclusion upsert for case file ${caseFile.caseFileNumber}: ` +
          `missing required field (id=${lastConclusion.id}, publicationDate=${lastConclusion.publicationDate})`,
      );
    } else {
      const operativePartId = lastConclusion.conclusionOperativePart?.id ?? null;
      await prisma.conclusion.upsert({
        where: { id: lastConclusion.id },
        update: {
          conclusionSense: lastConclusion.conclusionSense,
          publicationDate: new Date(lastConclusion.publicationDate),
          author: lastConclusion.author,
          conclusionOperativePartId: operativePartId,
        },
        create: {
          id: lastConclusion.id,
          conclusionSense: lastConclusion.conclusionSense,
          publicationDate: new Date(lastConclusion.publicationDate),
          author: lastConclusion.author,
          conclusionOperativePartId: operativePartId,
        },
      });
    }
  }

  if (caseFile.lastHearing) {
    await prisma.hearing.upsert({
      where: { hearingId: caseFile.lastHearing.hearingId },
      update: {
        convocationDate: new Date(caseFile.lastHearing.convocationDate),
        room: caseFile.lastHearing.room,
        lastConclusionId: caseFile.lastHearing.lastConclusion?.id,
      },
      create: {
        hearingId: caseFile.lastHearing.hearingId,
        convocationDate: new Date(caseFile.lastHearing.convocationDate),
        room: caseFile.lastHearing.room,
        lastConclusionId: caseFile.lastHearing.lastConclusion?.id,
      },
    });
  }

  await prisma.caseFile.upsert({
    where: { caseFileNumber: caseFile.caseFileNumber },
    update: {
      // The case file was returned by Telerecours, so it is not deleted: clear
      // any previous soft-delete flag (a case file that reappears comes back).
      isDeleted: false,
      deletedAt: null,
      procedureState: caseFile.procedureState,
      assignedToLegalEntityDivisionId: caseFile.assignedToLegalEntityDivision.id,
      // `undefined` leaves the column as-is rather than clearing it.
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
      caseFileNumber: caseFile.caseFileNumber,
      procedureState: caseFile.procedureState,
      assignedToLegalEntityDivisionId: caseFile.assignedToLegalEntityDivision.id,
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

  await upsertCaseFileActorLink(
    prisma,
    caseFile.caseFileNumber,
    caseFile.mainClaimant,
    { isMainClaimant: true, isMainDefender: false },
    anonymize,
  );
  if (caseFile.mainDefender) {
    await upsertCaseFileActorLink(
      prisma,
      caseFile.caseFileNumber,
      caseFile.mainDefender,
      { isMainClaimant: false, isMainDefender: true },
      anonymize,
    );
  }

  return true;
}
