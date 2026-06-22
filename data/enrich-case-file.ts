import { PrismaClient } from "@prisma/client";
import { getTelerecoursCaseFileClient } from "./telerecours-client";
import {
  Actor,
  AttachedFile,
  CaseFile,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  PagedResponse,
} from "./interfaces";
import { anonymizeActor } from "./anonymize";

// The Prisma client is passed in so that this module can be reused both by the
// standalone scraping script (its own `new PrismaClient`) and by the webapp
// (the `@/app/lib/prisma` singleton).
type Client = ReturnType<typeof getTelerecoursCaseFileClient>;

function parseDate(value: string | null | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

// Normalize a string for case- and accent-insensitive comparison.
function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// The "last producer" is the actor of the most recent event whose measure label
// starts with "reception" (case- and accent-insensitive). Returns its actorId,
// or null when no such event exists.
export function findLastProducerId(events: CaseFileEvent[]): number | null {
  let latest: CaseFileEvent | null = null;
  for (const event of events) {
    if (!normalizeLabel(event.measure.label).startsWith("reception")) continue;
    if (!latest || new Date(event.eventDate) > new Date(latest.eventDate)) {
      latest = event;
    }
  }
  return latest?.actor?.id ?? null;
}

async function upsertActor(
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
    qualityCode: actor.quality?.code || "R",
  };
  await prisma.actor.upsert({
    where: { id: actor.id },
    update: data,
    create: { id: actor.id, ...data },
  });
}

export async function upsertCaseFile(
  prisma: PrismaClient,
  caseFile: CaseFile,
  anonymize: boolean = false,
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

  if (caseFile.mainClaimant.quality) {
    await prisma.quality.upsert({
      where: { code: caseFile.mainClaimant.quality.code },
      update: { name: caseFile.mainClaimant.quality.name },
      create: {
        code: caseFile.mainClaimant.quality.code,
        name: caseFile.mainClaimant.quality.name,
      },
    });
  }
  if (caseFile.mainDefender && caseFile.mainDefender.quality) {
    await prisma.quality.upsert({
      where: { code: caseFile.mainDefender.quality.code },
      update: { name: caseFile.mainDefender.quality.name },
      create: {
        code: caseFile.mainDefender.quality.code,
        name: caseFile.mainDefender.quality.name,
      },
    });
  }

  await prisma.legalEntityDivision.upsert({
    where: { id: caseFile.assignedToLegalEntityDivision.id },
    update: {
      name: caseFile.assignedToLegalEntityDivision.name,
      shortName: caseFile.assignedToLegalEntityDivision.shortName,
    },
    create: {
      id: caseFile.assignedToLegalEntityDivision.id,
      name: caseFile.assignedToLegalEntityDivision.name,
      shortName: caseFile.assignedToLegalEntityDivision.shortName,
    },
  });

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

  await upsertActor(prisma, caseFile.mainClaimant, anonymize);
  if (caseFile.mainDefender) {
    await upsertActor(prisma, caseFile.mainDefender, anonymize);
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
      urgencyId: caseFile.urgency?.id,
      lastStatusId: caseFile.lastStatus.id,
      lastStatusDate: new Date(caseFile.lastStatus.statusDate),
      mainClaimantId: caseFile.mainClaimant.id,
      mainDefenderId: caseFile.mainDefender?.id,
      lastHearingId: caseFile.lastHearing?.hearingId,
    },
    create: {
      caseFileNumber: caseFile.caseFileNumber,
      procedureState: caseFile.procedureState,
      assignedToLegalEntityDivisionId: caseFile.assignedToLegalEntityDivision.id,
      urgencyId: caseFile.urgency?.id,
      lastStatusId: caseFile.lastStatus.id,
      lastStatusDate: new Date(caseFile.lastStatus.statusDate),
      mainClaimantId: caseFile.mainClaimant.id,
      mainDefenderId: caseFile.mainDefender?.id,
      lastHearingId: caseFile.lastHearing?.hearingId,
    },
  });

  return true;
}

// Iterate over every page of a paginated endpoint. The fetcher receives the
// page number (0-based) and must return a PagedResponse<T>.
async function* paginate<T>(
  fetcher: (page: number) => Promise<PagedResponse<T>>,
): AsyncGenerator<T> {
  let page = 0;
  while (true) {
    const response = await fetcher(page);
    for (const item of response.content) {
      yield item;
    }
    const totalPages = response.page?.totalPages ?? 1;
    if (page + 1 >= totalPages) return;
    page += 1;
  }
}

async function upsertCaseFileDetail(prisma: PrismaClient, detail: CaseFileDetail): Promise<void> {
  if (detail.chamber) {
    await prisma.chamber.upsert({
      where: { id: detail.chamber.id },
      update: { name: detail.chamber.name },
      create: { id: detail.chamber.id, name: detail.chamber.name },
    });
  }

  await prisma.caseFile.update({
    where: { caseFileNumber: detail.caseFileNumber },
    data: {
      title: detail.title ?? null,
      creationDate: parseDate(detail.creationDate),
      depositDate: parseDate(detail.depositDate),
      type: detail.type ?? null,
      estimatedHearingDate: parseDate(detail.estimatedHearingDate),
      estimatedHearingPeriod: detail.estimatedHearingPeriod ?? null,
      earliestInstructionClosingDate: parseDate(detail.earliestInstructionClosingDate),
      lastDecisionReading: parseDate(detail.lastDecisionReading),
      directoryReference: detail.directory?.reference ?? null,
      directoryComplementaryEmails: detail.directory?.complementaryRecipientEmails ?? [],
      keywords: detail.keywords ?? [],
      recipientContactCount: detail.recipientContactCount ?? null,
      chamberId: detail.chamber?.id ?? null,
    },
  });
}

async function upsertHearingForCaseFile(
  prisma: PrismaClient,
  caseFileNumber: string,
  hearing: Hearing,
): Promise<void> {
  if (hearing.lastConclusion?.conclusionOperativePart) {
    await prisma.conclusionOperativePart.upsert({
      where: { id: hearing.lastConclusion.conclusionOperativePart.id },
      update: { label: hearing.lastConclusion.conclusionOperativePart.label },
      create: {
        id: hearing.lastConclusion.conclusionOperativePart.id,
        label: hearing.lastConclusion.conclusionOperativePart.label,
      },
    });
  }
  if (hearing.lastConclusion?.id != null && hearing.lastConclusion.publicationDate != null) {
    await prisma.conclusion.upsert({
      where: { id: hearing.lastConclusion.id },
      update: {
        conclusionSense: hearing.lastConclusion.conclusionSense,
        publicationDate: new Date(hearing.lastConclusion.publicationDate),
        author: hearing.lastConclusion.author,
        conclusionOperativePartId: hearing.lastConclusion.conclusionOperativePart?.id ?? null,
      },
      create: {
        id: hearing.lastConclusion.id,
        conclusionSense: hearing.lastConclusion.conclusionSense,
        publicationDate: new Date(hearing.lastConclusion.publicationDate),
        author: hearing.lastConclusion.author,
        conclusionOperativePartId: hearing.lastConclusion.conclusionOperativePart?.id ?? null,
      },
    });
  }

  await prisma.hearing.upsert({
    where: { hearingId: hearing.hearingId },
    update: {
      convocationDate: new Date(hearing.convocationDate),
      room: hearing.room,
      creationDate: parseDate(hearing.creationDate),
      modificationDates: (hearing.modificationDates ?? []).map((d) => new Date(d)),
      lastConclusionId: hearing.lastConclusion?.id ?? null,
      caseFileNumber,
    },
    create: {
      hearingId: hearing.hearingId,
      convocationDate: new Date(hearing.convocationDate),
      room: hearing.room,
      creationDate: parseDate(hearing.creationDate),
      modificationDates: (hearing.modificationDates ?? []).map((d) => new Date(d)),
      lastConclusionId: hearing.lastConclusion?.id ?? null,
      caseFileNumber,
    },
  });
}

async function upsertCaseFileEvent(
  prisma: PrismaClient,
  caseFileNumber: string,
  event: CaseFileEvent,
  anonymize: boolean,
): Promise<void> {
  await prisma.measure.upsert({
    where: { code: event.measure.id },
    update: {
      label: event.measure.label,
      type: event.measure.type,
      isImportant: event.measure.isImportant,
      family: event.measure.family,
    },
    create: {
      code: event.measure.id,
      label: event.measure.label,
      type: event.measure.type,
      isImportant: event.measure.isImportant,
      family: event.measure.family,
    },
  });

  if (event.actor) {
    if (event.actor.quality) {
      await prisma.quality.upsert({
        where: { code: event.actor.quality.code },
        update: { name: event.actor.quality.name },
        create: { code: event.actor.quality.code, name: event.actor.quality.name },
      });
    }
    await upsertActor(prisma, event.actor, anonymize);
  }

  const data = {
    subEventId: event.subEventId,
    eventDate: new Date(event.eventDate),
    deadlineLabel: event.deadlineLabel,
    receiptDate: parseDate(event.receiptDate),
    instructionClosingDate: parseDate(event.instructionClosingDate),
    comment: event.comment,
    hasAttachment: event.hasAttachment,
    generateAR: event.generateAR,
    nbEventFile: event.nbEventFile,
    piecesNonDownloadable: event.piecesNonDownloadable,
    relatedEventCount: event.relatedEventCount,
    caseFileNumber,
    measureCode: event.measure.id,
    actorId: event.actor?.id ?? null,
  };
  await prisma.caseFileEvent.upsert({
    where: { id: event.id },
    update: data,
    create: { id: event.id, ...data },
  });
}

async function upsertAttachedFile(
  prisma: PrismaClient,
  caseFileNumber: string,
  file: AttachedFile,
): Promise<{ upserted: boolean; reason?: string }> {
  // The corresponding event must already have been created by phase B/measures.
  const event = await prisma.caseFileEvent.findUnique({ where: { id: file.eventId } });
  if (!event) {
    return { upserted: false, reason: `event ${file.eventId} not found` };
  }

  await prisma.fileFamilyType.upsert({
    where: { code: file.fileFamilyType },
    update: { label: file.fileTypeLabel },
    create: { code: file.fileFamilyType, label: file.fileTypeLabel },
  });
  // The measure attached to the file is also present in the events → upsert
  // defensively in case measures was partial.
  await prisma.measure.upsert({
    where: { code: file.measure.measureId },
    update: { label: file.measure.measureLabel, type: file.measure.measureType },
    create: {
      code: file.measure.measureId,
      label: file.measure.measureLabel,
      type: file.measure.measureType,
      isImportant: false,
      family: null,
    },
  });

  const data = {
    originalFileName: file.originalFileName,
    fileName: file.fileName,
    mimeType: file.mimeType,
    documentType: file.documentType,
    subEventId: file.subEventId,
    receiptAcknowledgmentId: file.receiptAcknowledgmentId,
    receiptAcknowledgmentType: file.receiptAcknowledgmentType,
    fileTypeLabel: file.fileTypeLabel,
    eventCreationDate: new Date(file.eventCreationDate),
    caseFileNumber,
    eventId: file.eventId,
    fileFamilyTypeCode: file.fileFamilyType,
  };
  await prisma.attachedFile.upsert({
    where: { encodedFileId: file.encodedFileId },
    update: data,
    create: { encodedFileId: file.encodedFileId, ...data },
  });
  return { upserted: true };
}

export async function enrichCaseFile(
  prisma: PrismaClient,
  client: Client,
  caseFileNumber: string,
  jurisdiction: string,
  anonymize: boolean,
): Promise<void> {
  // 1. Enriched detail
  const detail = (await client.getCaseFileDetail(
    caseFileNumber,
    jurisdiction,
  )) as unknown as CaseFileDetail;
  // Re-upsert the base CaseFile (in case the detail brings fields missing from
  // the list view) then fill the detail columns.
  if (detail.assignedToLegalEntityDivision && detail.lastStatus && detail.mainClaimant) {
    await upsertCaseFile(prisma, detail, anonymize);
  }
  await upsertCaseFileDetail(prisma, detail);

  // 2. All hearings
  let hearingsCount = 0;
  for await (const hearing of paginate<Hearing>(async (page) => {
    return (await client.getCaseFileHearings(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<Hearing>;
  })) {
    await upsertHearingForCaseFile(prisma, caseFileNumber, hearing);
    hearingsCount++;
  }

  // 3. All events (measures)
  let eventsCount = 0;
  const events: CaseFileEvent[] = [];
  for await (const event of paginate<CaseFileEvent>(async (page) => {
    return (await client.getCaseFileMeasures(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<CaseFileEvent>;
  })) {
    await upsertCaseFileEvent(prisma, caseFileNumber, event, anonymize);
    events.push(event);
    eventsCount++;
  }

  // Derive the last producer (actor of the most recent "reception…" event)
  // from the freshly upserted events.
  await prisma.caseFile.update({
    where: { caseFileNumber },
    data: { lastProducerId: findLastProducerId(events) },
  });

  // 4. All attached files
  let filesCount = 0;
  let filesSkipped = 0;
  for await (const file of paginate<AttachedFile>(async (page) => {
    return (await client.getCaseFileAttachedFiles(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<AttachedFile>;
  })) {
    const result = await upsertAttachedFile(prisma, caseFileNumber, file);
    if (result.upserted) {
      filesCount++;
    } else {
      filesSkipped++;
      console.warn(`  ⚠ Attached file ${file.encodedFileId} skipped: ${result.reason}`);
    }
  }

  const safeCaseFileNumberForLog = caseFileNumber.replace(/[\r\n]/g, "");
  console.log(
    `  ✓ ${safeCaseFileNumberForLog}: ${hearingsCount} hearings, ${eventsCount} events, ` +
      `${filesCount} files (${filesSkipped} skipped)`,
  );
}
