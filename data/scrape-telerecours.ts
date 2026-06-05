import { getTelerecoursCaseFileClient } from "./telerecours-client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import {
  Actor,
  AttachedFile,
  CaseFile,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  PagedResponse,
  RelatedCaseFileSummary,
} from "./interfaces";
import { anonymizeActor } from "./anonymize";

const TARGET_STATUS_LABEL = "Inscrit au rôle d'une audience";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Client = ReturnType<typeof getTelerecoursCaseFileClient>;

interface CaseFileApiResponse {
  content?: CaseFile[];
  page?: { totalPages?: number; totalElements?: number; number?: number };
}

interface Args {
  jurisdiction: string;
  page: number;
  size: number;
  sort?: string;
  all: boolean;
  legalEntityDivisionIds: number[];
  anonymize: boolean;
  skipEnrichment: boolean;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function parseDate(value: string | null | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

async function upsertActor(actor: Actor, anonymize: boolean = false): Promise<void> {
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

async function upsertCaseFile(caseFile: CaseFile, anonymize: boolean = false): Promise<boolean> {
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

  await upsertActor(caseFile.mainClaimant, anonymize);
  if (caseFile.mainDefender) {
    await upsertActor(caseFile.mainDefender, anonymize);
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

// ───── Phase B helpers ─────

// Itère sur toutes les pages d'un endpoint paginé. Le fetcher reçoit le n°
// de page (0-based) et doit retourner un PagedResponse<T>.
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

async function upsertCaseFileDetail(detail: CaseFileDetail): Promise<void> {
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

async function upsertHearingForCaseFile(caseFileNumber: string, hearing: Hearing): Promise<void> {
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
    await upsertActor(event.actor, anonymize);
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
  caseFileNumber: string,
  file: AttachedFile,
): Promise<{ upserted: boolean; reason?: string }> {
  // L'event correspondant doit déjà avoir été créé par la phase B/measures.
  const event = await prisma.caseFileEvent.findUnique({ where: { id: file.eventId } });
  if (!event) {
    return { upserted: false, reason: `event ${file.eventId} not found` };
  }

  await prisma.fileFamilyType.upsert({
    where: { code: file.fileFamilyType },
    update: { label: file.fileTypeLabel },
    create: { code: file.fileFamilyType, label: file.fileTypeLabel },
  });
  // La measure attachée au file est aussi présente dans les events → upsert
  // par sécurité au cas où measures aurait été partiel.
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

async function enrichCaseFile(
  client: Client,
  caseFileNumber: string,
  jurisdiction: string,
  anonymize: boolean,
): Promise<void> {
  // 1. Détail enrichi
  const detail = (await client.getCaseFileDetail(
    caseFileNumber,
    jurisdiction,
  )) as unknown as CaseFileDetail;
  // On ré-upsert la base CaseFile (au cas où le détail apporte des champs
  // manquants côté liste) puis on remplit les colonnes détail.
  if (detail.assignedToLegalEntityDivision && detail.lastStatus && detail.mainClaimant) {
    await upsertCaseFile(detail, anonymize);
  }
  await upsertCaseFileDetail(detail);

  // 2. Toutes les audiences
  let hearingsCount = 0;
  for await (const hearing of paginate<Hearing>(async (page) => {
    return (await client.getCaseFileHearings(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<Hearing>;
  })) {
    await upsertHearingForCaseFile(caseFileNumber, hearing);
    hearingsCount++;
  }

  // 3. Tous les events (measures)
  let eventsCount = 0;
  for await (const event of paginate<CaseFileEvent>(async (page) => {
    return (await client.getCaseFileMeasures(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<CaseFileEvent>;
  })) {
    await upsertCaseFileEvent(caseFileNumber, event, anonymize);
    eventsCount++;
  }

  // 4. Toutes les pièces jointes
  let filesCount = 0;
  let filesSkipped = 0;
  for await (const file of paginate<AttachedFile>(async (page) => {
    return (await client.getCaseFileAttachedFiles(
      caseFileNumber,
      jurisdiction,
      page,
    )) as unknown as PagedResponse<AttachedFile>;
  })) {
    const result = await upsertAttachedFile(caseFileNumber, file);
    if (result.upserted) {
      filesCount++;
    } else {
      filesSkipped++;
      console.warn(`  ⚠ Attached file ${file.encodedFileId} skipped: ${result.reason}`);
    }
  }

  console.log(
    `  ✓ ${caseFileNumber}: ${hearingsCount} hearings, ${eventsCount} events, ` +
      `${filesCount} files (${filesSkipped} skipped)`,
  );
}

// ───── Phase C : related case files ─────

async function linkRelatedCaseFiles(
  client: Client,
  caseFileNumber: string,
  jurisdiction: string,
): Promise<{ linked: number; orphans: number }> {
  const report = (await client.getCaseFileRelatedReport(
    caseFileNumber,
    jurisdiction,
  )) as unknown as { accessibleCaseFiles?: RelatedCaseFileSummary[] };
  const related = report.accessibleCaseFiles ?? [];

  let linked = 0;
  let orphans = 0;
  for (const item of related) {
    if (item.caseFileNumber === caseFileNumber) continue;
    const target = await prisma.caseFile.findUnique({
      where: { caseFileNumber: item.caseFileNumber },
      select: { caseFileNumber: true },
    });
    if (!target) {
      console.warn(`  ⚠ ${caseFileNumber} → ${item.caseFileNumber}: dossier lié absent en DB`);
      orphans++;
      // FIXME: We get the object following th structure RelatedCaseFileSummary
      // Should we upsert the object or try to get it from getCaseFileDetail route ?
      // Be careful to the new account without the right to see non DDTES case files.
      continue;
    }
    await prisma.relatedCaseFile.upsert({
      where: {
        caseFileNumber_relatedCaseFileNumber: {
          caseFileNumber,
          relatedCaseFileNumber: item.caseFileNumber,
        },
      },
      update: {},
      create: {
        caseFileNumber,
        relatedCaseFileNumber: item.caseFileNumber,
      },
    });
    linked++;
  }
  return { linked, orphans };
}

// ───── Args ─────

function parseDivisionIds(value: string): number[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

function parseArgs(): Args {
  const args: Args = {
    jurisdiction: "TA069",
    page: 0,
    size: 30,
    sort: undefined,
    all: false,
    legalEntityDivisionIds: [],
    anonymize: false,
    skipEnrichment: false,
  };

  // Permet de distinguer un --legalEntityDivisionIds explicite du défaut issu
  // de l'environnement (résolu après coup, car il dépend de la juridiction).
  let divisionIdsFromCli = false;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--jurisdiction" && i + 1 < process.argv.length) {
      args.jurisdiction = process.argv[++i];
    } else if (arg === "--page" && i + 1 < process.argv.length) {
      args.page = parseInt(process.argv[++i], 10);
    } else if (arg === "--size" && i + 1 < process.argv.length) {
      args.size = parseInt(process.argv[++i], 10);
    } else if (arg === "--sort" && i + 1 < process.argv.length) {
      args.sort = process.argv[++i];
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--legalEntityDivisionIds" && i + 1 < process.argv.length) {
      args.legalEntityDivisionIds = parseDivisionIds(process.argv[++i]);
      divisionIdsFromCli = true;
    } else if (arg === "--anonymize") {
      args.anonymize = true;
    } else if (arg === "--skipEnrichment") {
      args.skipEnrichment = true;
    }
  }

  // Défaut des divisions : variable d'env <JURIDICTION>_TELERECOURS_DIVISIONS
  // (ex. TA069_TELERECOURS_DIVISIONS=2488,1234), sauf si fourni en CLI.
  if (!divisionIdsFromCli) {
    args.legalEntityDivisionIds = parseDivisionIds(
      getEnv(`${args.jurisdiction}_TELERECOURS_DIVISIONS`),
    );
  }

  return args;
}

// ───── Main ─────

async function phaseA(
  client: Client,
  args: Args,
): Promise<{ processed: number; upserted: number }> {
  console.log(`\n══ Phase A — scrape liste /api/case-file (${args.jurisdiction}) ══`);

  let pageIndex = args.page;
  let totalPages: number | null = null;
  let totalElements: number | null = null;
  let totalProcessed = 0;
  let upsertCount = 0;
  const skippedCaseFileNumbers: string[] = [];
  const failedCaseFileNumbers: string[] = [];

  while (true) {
    console.log(
      `→ Calling /api/case-file (jurisdiction=${args.jurisdiction}, ` +
        `page=${pageIndex}, size=${args.size})…`,
    );

    const response = (await client.getCaseFiles(
      args.jurisdiction,
      pageIndex,
      args.size,
      args.sort,
      !args.all,
      args.legalEntityDivisionIds,
    )) as CaseFileApiResponse;

    const content = response.content;
    if (!Array.isArray(content)) {
      console.error("⚠ Unexpected response — no usable 'content' key found.");
      throw new Error("missing content");
    }

    const pageInfo = response.page;
    if (pageInfo) {
      totalPages = pageInfo.totalPages ?? totalPages;
      totalElements = pageInfo.totalElements ?? totalElements;
      const current = pageInfo.number ?? pageIndex;
      console.log(
        `  page ${current + 1}/${totalPages} — ${content.length} items ` +
          `(processed so far ${totalProcessed + content.length}/${totalElements})`,
      );
    } else {
      totalPages = content.length > 0 ? null : pageIndex + 1;
    }

    console.log(`→ Upserting page ${pageIndex + 1} in database…`);
    for (const item of content) {
      totalProcessed++;
      if (!item.caseFileNumber) {
        console.warn("⚠ Skipping item without case file number");
        skippedCaseFileNumbers.push("(unknown)");
        continue;
      }

      try {
        const upserted = await upsertCaseFile(item as CaseFile, args.anonymize);
        if (upserted) upsertCount++;
        else skippedCaseFileNumbers.push(item.caseFileNumber);
      } catch (error) {
        console.error(
          `✗ Failed to upsert case file ${item.caseFileNumber}:`,
          error instanceof Error ? error.message : String(error),
        );
        failedCaseFileNumbers.push(item.caseFileNumber);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (totalPages === null || pageIndex + 1 >= totalPages) break;
    pageIndex += 1;
  }

  console.log(
    `✓ Phase A : ${upsertCount}/${totalProcessed} dossiers upsertés ` +
      `(${skippedCaseFileNumbers.length} skipped, ${failedCaseFileNumbers.length} failed).`,
  );
  return { processed: totalProcessed, upserted: upsertCount };
}

async function phaseB(
  client: Client,
  args: Args,
): Promise<{ enriched: number; failed: number; targetCount: number }> {
  console.log(`\n══ Phase B — enrichissement des dossiers "${TARGET_STATUS_LABEL}" ══`);

  const targets = await prisma.caseFile.findMany({
    where: {
      lastStatus: { label: TARGET_STATUS_LABEL },
      assignedToLegalEntityDivisionId: { in: args.legalEntityDivisionIds },
    },
    select: { caseFileNumber: true },
    orderBy: { lastStatusDate: "desc" },
  });

  console.log(`→ ${targets.length} dossiers cibles trouvés en DB.`);

  let enriched = 0;
  let failed = 0;
  for (const { caseFileNumber } of targets) {
    try {
      console.log(`→ Enrichissement ${caseFileNumber}…`);
      await enrichCaseFile(client, caseFileNumber, args.jurisdiction, args.anonymize);
      enriched++;
    } catch (error) {
      console.error(
        `✗ Phase B failed for ${caseFileNumber}:`,
        error instanceof Error ? error.message : String(error),
      );
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`✓ Phase B : ${enriched}/${targets.length} dossiers enrichis (${failed} échec(s)).`);
  return { enriched, failed, targetCount: targets.length };
}

async function phaseC(
  client: Client,
  args: Args,
): Promise<{ linked: number; orphans: number; targetCount: number }> {
  console.log(`\n══ Phase C — liens entre dossiers (related-case-files) ══`);

  const targets = await prisma.caseFile.findMany({
    where: {
      lastStatus: { label: TARGET_STATUS_LABEL },
      assignedToLegalEntityDivisionId: { in: args.legalEntityDivisionIds },
    },
    select: { caseFileNumber: true },
  });

  let linkedTotal = 0;
  let orphansTotal = 0;
  for (const { caseFileNumber } of targets) {
    try {
      const { linked, orphans } = await linkRelatedCaseFiles(
        client,
        caseFileNumber,
        args.jurisdiction,
      );
      linkedTotal += linked;
      orphansTotal += orphans;
    } catch (error) {
      console.error(
        `✗ Phase C failed for ${caseFileNumber}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `✓ Phase C : ${linkedTotal} liens créés, ${orphansTotal} dossiers liés absents de la DB.`,
  );
  return { linked: linkedTotal, orphans: orphansTotal, targetCount: targets.length };
}

async function main(): Promise<number> {
  const args = parseArgs();
  const username = getEnv(`${args.jurisdiction}_TELERECOURS_USERNAME`);
  const password = getEnv(`${args.jurisdiction}_TELERECOURS_PASSWORD`);
  const client = getTelerecoursCaseFileClient({ username, password });

  const a = await phaseA(client, args);
  if (a.processed === 0) {
    console.error("⚠ No case files retrieved.");
    await prisma.$disconnect();
    return 2;
  }

  if (!args.skipEnrichment) {
    await phaseB(client, args);
    await phaseC(client, args);
  } else {
    console.log("→ --skipEnrichment : phases B et C ignorées.");
  }

  await prisma.$disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
