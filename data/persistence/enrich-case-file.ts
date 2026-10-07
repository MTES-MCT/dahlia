import { PrismaClient } from "@prisma/client";
import { TelerecoursClient } from "../telerecours/client.interface";
import {
  AttachedFile,
  CaseFileActorDto,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  LastDecisionReading,
} from "../telerecours/types";
import type { CaseFileKey } from "./case-file-key";
import { computeContentHash } from "./content-hash";
import { paginate } from "./paginate";
import { upsertCaseFileActorsFromApi } from "./upsert-case-file-actors";
import { upsertActor, upsertCaseFile } from "./upsert-case-file";
import { upsertHearingWithConclusion } from "./upsert-hearing";
import { upsertJurisdiction } from "./upsert-jurisdiction";

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
  key: CaseFileKey,
  lastDecisionReading: LastDecisionReading | null | undefined,
): Promise<void> {
  if (!lastDecisionReading) {
    await prisma.lastDecisionReading.deleteMany({ where: key });
    return;
  }

  const readingDate = parseDate(lastDecisionReading.readingDate);
  if (!readingDate) {
    console.warn(
      `⚠ Skipping lastDecisionReading for ${key.caseFileNumber}: invalid readingDate "${lastDecisionReading.readingDate}"`,
    );
    await prisma.lastDecisionReading.deleteMany({ where: key });
    return;
  }

  await prisma.lastDecisionReading.upsert({
    where: { jurisdictionCode_caseFileNumber: key },
    update: {
      readingDate,
      notificationDate: parseDate(lastDecisionReading.notificationDate),
      nature: lastDecisionReading.nature ?? null,
      operativePart: lastDecisionReading.operativePart ?? null,
    },
    create: {
      ...key,
      readingDate,
      notificationDate: parseDate(lastDecisionReading.notificationDate),
      nature: lastDecisionReading.nature ?? null,
      operativePart: lastDecisionReading.operativePart ?? null,
    },
  });
}

async function upsertCaseFileDetail(
  prisma: PrismaClient,
  key: CaseFileKey,
  detail: CaseFileDetail,
): Promise<void> {
  const { jurisdictionCode } = key;
  if (detail.chamber) {
    await prisma.chamber.upsert({
      where: { jurisdictionCode_id: { jurisdictionCode, id: detail.chamber.id } },
      update: { name: detail.chamber.name },
      create: { jurisdictionCode, id: detail.chamber.id, name: detail.chamber.name },
    });
  }

  await prisma.caseFile.update({
    where: { jurisdictionCode_caseFileNumber: key },
    data: {
      title: detail.title ?? null,
      creationDate: parseDate(detail.creationDate),
      depositDate: parseDate(detail.depositDate),
      type: detail.type ?? null,
      estimatedHearingDate: parseDate(detail.estimatedHearingDate),
      estimatedHearingPeriod: detail.estimatedHearingPeriod ?? null,
      earliestInstructionClosingDate: parseDate(detail.earliestInstructionClosingDate),
      directoryReference: detail.directory?.reference ?? null,
      directoryComplementaryEmails: detail.directory?.complementaryRecipientEmails ?? null,
      keywords: detail.keywords ?? [],
      recipientContactCount: detail.recipientContactCount ?? null,
      chamberId: detail.chamber?.id ?? null,
      isDeleted: false,
    },
  });

  await upsertLastDecisionReading(prisma, key, detail.lastDecisionReading);
}

async function upsertHearingForCaseFile(
  prisma: PrismaClient,
  key: CaseFileKey,
  hearing: Hearing,
): Promise<void> {
  await upsertHearingWithConclusion(prisma, key.jurisdictionCode, hearing, key.caseFileNumber);
}

async function upsertCaseFileEvent(
  prisma: PrismaClient,
  key: CaseFileKey,
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
    await upsertActor(prisma, key.jurisdictionCode, event.actor, anonymize);
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
    caseFileNumber: key.caseFileNumber,
    measureCode: event.measure.id,
    actorId: event.actor?.id ?? null,
  };
  const { jurisdictionCode } = key;
  await prisma.caseFileEvent.upsert({
    where: { jurisdictionCode_id: { jurisdictionCode, id: event.id } },
    update: data,
    create: { jurisdictionCode, id: event.id, ...data },
  });
}

async function upsertAttachedFile(
  prisma: PrismaClient,
  key: CaseFileKey,
  file: AttachedFile,
  updatePieceNumbers: boolean,
): Promise<{ upserted: boolean; reason?: string }> {
  const { jurisdictionCode } = key;
  // The corresponding event must already have been created by phase B/measures.
  const event = await prisma.caseFileEvent.findUnique({
    where: { jurisdictionCode_id: { jurisdictionCode, id: file.eventId } },
  });
  if (!event) {
    return { upserted: false, reason: `event ${file.eventId} not found` };
  }

  const familyType = await prisma.fileFamilyType.upsert({
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
    fileFamilyTypeLabel: familyType.label,
    eventCreationDate: new Date(file.eventCreationDate),
    caseFileNumber: key.caseFileNumber,
    eventId: file.eventId,
    fileFamilyTypeCode: file.fileFamilyType,
  };
  const pieceNumber = leadingNumber(file.fileName);
  await prisma.attachedFile.upsert({
    where: {
      jurisdictionCode_encodedFileId: { jurisdictionCode, encodedFileId: file.encodedFileId },
    },
    // `update` leaves user-editable fields (dahliaName, number, comment)
    // untouched so manual edits survive a re-scrape, unless --update-piece-numbers
    // was passed. The number derived from the file name is always seeded on create.
    update: updatePieceNumbers ? { ...data, number: pieceNumber } : data,
    create: {
      jurisdictionCode,
      encodedFileId: file.encodedFileId,
      ...data,
      number: pieceNumber,
    },
  });
  return { upserted: true };
}

// --force: delete the attached files and events stored for the case file but
// no longer returned by Telerecours (e.g. rows of another court's case file
// merged under this number before ids were scoped by court). Attached files go
// first: an event still referenced by a kept attached file is kept too (FK).
// Deleted attached files lose their Dahlia metadata (name, number, comment).
async function deleteStaleEventsAndFiles(
  prisma: PrismaClient,
  key: CaseFileKey,
  events: CaseFileEvent[],
  files: AttachedFile[],
): Promise<void> {
  const deletedFiles = await prisma.attachedFile.deleteMany({
    where: { ...key, encodedFileId: { notIn: files.map((file) => file.encodedFileId) } },
  });
  const deletedEvents = await prisma.caseFileEvent.deleteMany({
    where: {
      ...key,
      id: { notIn: events.map((event) => event.id) },
      attachedFiles: { none: {} },
    },
  });
  if (deletedFiles.count > 0 || deletedEvents.count > 0) {
    console.log(
      `  ⚑ ${key.caseFileNumber.replace(/[\r\n]/g, "")}: ${deletedEvents.count} événement(s) et ` +
        `${deletedFiles.count} pièce(s) absents de Télérecours supprimés (--force)`,
    );
  }
}

// Fetch the enriched detail, all hearings, all events (measures) and all
// attached files for a single case file, and upsert them. `jurisdiction` is the
// Dahlia instance (e.g. "TA069bis"): it selects the credentials and resolves the
// court code that scopes every id. The case file is (re)created from the detail
// when it has the required fields, otherwise it must already exist (phase A).
export async function enrichCaseFile(
  prisma: PrismaClient,
  client: TelerecoursClient,
  caseFileNumber: string,
  jurisdiction: string,
  anonymize: boolean,
  updatePieceNumbers: boolean = false,
  force: boolean = false,
): Promise<void> {
  // Tag the case file with the jurisdiction this enrichment was fetched from.
  // Also covers the webapp's single-case-file refresh, which never runs phase A.
  const resolvedJurisdiction = await upsertJurisdiction(prisma, jurisdiction);
  const key: CaseFileKey = {
    jurisdictionCode: resolvedJurisdiction.jurisdictionCode,
    caseFileNumber,
  };

  // 1. Enriched detail
  const detail = await client.getCaseFileDetail(caseFileNumber, jurisdiction);
  // Re-upsert the base CaseFile (in case the detail brings fields missing from
  // the list view) then fill the detail columns.
  if (detail.lastStatus && detail.mainClaimant) {
    await upsertCaseFile(prisma, detail, anonymize, resolvedJurisdiction);
  }
  await upsertCaseFileDetail(prisma, key, detail);

  // 2. All actors (parties, lawyers, etc.)
  const actors: CaseFileActorDto[] = [];
  for await (const actor of paginate<CaseFileActorDto>((page) =>
    client.getCaseFileActors(caseFileNumber, jurisdiction, page),
  )) {
    actors.push(actor);
  }
  await upsertCaseFileActorsFromApi(prisma, key, actors, anonymize);
  const actorsCount = actors.length;

  // 3. All hearings
  const hearings: Hearing[] = [];
  for await (const hearing of paginate<Hearing>((page) =>
    client.getCaseFileHearings(caseFileNumber, jurisdiction, page),
  )) {
    await upsertHearingForCaseFile(prisma, key, hearing);
    hearings.push(hearing);
  }
  const hearingIds = hearings.map((h) => h.hearingId);
  await prisma.caseFileHearing.deleteMany({
    where: {
      ...key,
      ...(hearingIds.length > 0 ? { hearingId: { notIn: hearingIds } } : {}),
    },
  });
  const hearingsCount = hearings.length;

  // 4. All events (measures)
  const events: CaseFileEvent[] = [];
  for await (const event of paginate<CaseFileEvent>((page) =>
    client.getCaseFileMeasures(caseFileNumber, jurisdiction, page),
  )) {
    await upsertCaseFileEvent(prisma, key, event, anonymize);
    events.push(event);
  }
  const eventsCount = events.length;

  // 5. All attached files
  let filesCount = 0;
  let filesSkipped = 0;
  const files: AttachedFile[] = [];
  for await (const file of paginate<AttachedFile>((page) =>
    client.getCaseFileAttachedFiles(caseFileNumber, jurisdiction, page),
  )) {
    const result = await upsertAttachedFile(prisma, key, file, updatePieceNumbers);
    files.push(file);
    if (result.upserted) {
      filesCount++;
    } else {
      filesSkipped++;
      console.warn(`  ⚠ Attached file ${file.encodedFileId} skipped: ${result.reason}`);
    }
  }

  if (force) {
    await deleteStaleEventsAndFiles(prisma, key, events, files);
  }

  // Fingerprint the whole scraped payload (detail + linked elements) so we can
  // tell whether anything changed since the previous scrape. Collections are
  // sorted by their stable id so a mere reordering never looks like a change.
  const contentHash = computeContentHash({
    detail,
    actors: [...actors].sort((a, b) => a.id - b.id),
    hearings: [...hearings].sort((a, b) => a.hearingId.localeCompare(b.hearingId)),
    events: [...events].sort((a, b) => a.id - b.id),
    files: [...files].sort((a, b) => a.encodedFileId.localeCompare(b.encodedFileId)),
  });
  const existing = await prisma.caseFile.findUnique({
    where: { jurisdictionCode_caseFileNumber: key },
    select: { telerecoursContentHash: true },
  });
  const hasChanged = existing?.telerecoursContentHash !== contentHash;
  const now = new Date();

  // Derive the last producer (actor of the most recent "reception…" event) from
  // the freshly upserted events, and maintain the Telerecours sync fields.
  //   - telerecoursSyncAt is always refreshed (a sync happened).
  //   - telerecoursUpdatedAt (and the stored hash) only move when the payload
  //     actually changed. `updatedAt` is left to Prisma and never touched here.
  await prisma.caseFile.update({
    where: { jurisdictionCode_caseFileNumber: key },
    data: {
      lastProducerId: findLastProducerId(events),
      telerecoursSyncAt: now,
      ...(hasChanged ? { telerecoursUpdatedAt: now, telerecoursContentHash: contentHash } : {}),
    },
  });

  const safeCaseFileNumberForLog = caseFileNumber.replace(/[\r\n]/g, "");
  console.log(
    `  ✓ ${safeCaseFileNumberForLog}: ${actorsCount} actors, ${hearingsCount} hearings, ${eventsCount} events, ` +
      `${filesCount} files (${filesSkipped} skipped)`,
  );
}
