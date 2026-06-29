import { PrismaClient } from "@prisma/client";
import { TelerecoursClient } from "../telerecours/client.interface";
import {
  AttachedFile,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  LastDecisionReading,
} from "../telerecours/types";
import { paginate } from "./paginate";
import { upsertActor, upsertCaseFile } from "./upsert-case-file";

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Extract the leading digit sequence of a file name, kept as a string so any
// leading zeros are preserved (e.g. "002_facture.pdf" → "002"). Returns null
// when the name does not start with a digit.
export function leadingNumber(fileName: string): string | null {
  const match = fileName.match(/^\d+/);
  return match ? match[0] : null;
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
    if (
      !normalizeLabel(event.measure.label).startsWith("reception") &&
      !normalizeLabel(event.measure.label).startsWith("requete nouvelle")
    )
      continue;
    if (!latest || new Date(event.eventDate) > new Date(latest.eventDate)) {
      latest = event;
    }
  }
  return latest?.actor?.id ?? null;
}

async function upsertLastDecisionReading(
  prisma: PrismaClient,
  caseFileNumber: string,
  lastDecisionReading: LastDecisionReading | null | undefined,
): Promise<void> {
  if (!lastDecisionReading) {
    await prisma.lastDecisionReading.deleteMany({ where: { caseFileNumber } });
    return;
  }

  const readingDate = parseDate(lastDecisionReading.readingDate);
  if (!readingDate) {
    console.warn(
      `⚠ Skipping lastDecisionReading for ${caseFileNumber}: invalid readingDate "${lastDecisionReading.readingDate}"`,
    );
    await prisma.lastDecisionReading.deleteMany({ where: { caseFileNumber } });
    return;
  }

  await prisma.lastDecisionReading.upsert({
    where: { caseFileNumber },
    update: {
      readingDate,
      notificationDate: parseDate(lastDecisionReading.notificationDate),
      nature: lastDecisionReading.nature ?? null,
      operativePart: lastDecisionReading.operativePart ?? null,
    },
    create: {
      caseFileNumber,
      readingDate,
      notificationDate: parseDate(lastDecisionReading.notificationDate),
      nature: lastDecisionReading.nature ?? null,
      operativePart: lastDecisionReading.operativePart ?? null,
    },
  });
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
      directoryReference: detail.directory?.reference ?? null,
      directoryComplementaryEmails: detail.directory?.complementaryRecipientEmails ?? [],
      keywords: detail.keywords ?? [],
      recipientContactCount: detail.recipientContactCount ?? null,
      chamberId: detail.chamber?.id ?? null,
    },
  });

  await upsertLastDecisionReading(prisma, detail.caseFileNumber, detail.lastDecisionReading);
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
  updatePieceNumbers: boolean,
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
  const pieceNumber = leadingNumber(file.originalFileName);
  await prisma.attachedFile.upsert({
    where: { encodedFileId: file.encodedFileId },
    // `update` leaves user-editable fields (dahliaName, number, comment)
    // untouched so manual edits survive a re-scrape, unless --update-piece-numbers
    // was passed. The number derived from the file name is always seeded on create.
    update: updatePieceNumbers ? { ...data, number: pieceNumber } : data,
    create: {
      encodedFileId: file.encodedFileId,
      ...data,
      number: pieceNumber,
    },
  });
  return { upserted: true };
}

// Fetch the enriched detail, all hearings, all events (measures) and all
// attached files for a single case file, and upsert them. The case file must
// already exist in DB (created by phase A).
export async function enrichCaseFile(
  prisma: PrismaClient,
  client: TelerecoursClient,
  caseFileNumber: string,
  jurisdiction: string,
  anonymize: boolean,
  updatePieceNumbers: boolean = false,
): Promise<void> {
  // 1. Enriched detail
  const detail = await client.getCaseFileDetail(caseFileNumber, jurisdiction);
  // Re-upsert the base CaseFile (in case the detail brings fields missing from
  // the list view) then fill the detail columns.
  if (detail.assignedToLegalEntityDivision && detail.lastStatus && detail.mainClaimant) {
    await upsertCaseFile(prisma, detail, anonymize);
  }
  await upsertCaseFileDetail(prisma, detail);

  // 2. All hearings
  let hearingsCount = 0;
  for await (const hearing of paginate<Hearing>((page) =>
    client.getCaseFileHearings(caseFileNumber, jurisdiction, page),
  )) {
    await upsertHearingForCaseFile(prisma, caseFileNumber, hearing);
    hearingsCount++;
  }

  // 3. All events (measures)
  let eventsCount = 0;
  const events: CaseFileEvent[] = [];
  for await (const event of paginate<CaseFileEvent>((page) =>
    client.getCaseFileMeasures(caseFileNumber, jurisdiction, page),
  )) {
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
  for await (const file of paginate<AttachedFile>((page) =>
    client.getCaseFileAttachedFiles(caseFileNumber, jurisdiction, page),
  )) {
    const result = await upsertAttachedFile(
      prisma,
      caseFileNumber,
      file,
      updatePieceNumbers,
    );
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
