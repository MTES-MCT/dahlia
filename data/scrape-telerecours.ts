import { getTelerecoursCaseFileClient } from "./telerecours-client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { Actor, CaseFile } from "./interfaces";
import { anonymizeActor } from "./anonymize";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface PageInfo {
  totalPages?: number;
  totalElements?: number;
  number?: number;
}

interface CaseFileApiResponse {
  content?: CaseFile[];
  page?: PageInfo;
  [key: string]: unknown;
}

interface Args {
  jurisdiction: string;
  page: number;
  size: number;
  sort?: string;
  all: boolean;
  legalEntityDivisionIds: number[];
  anonymize: boolean;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

async function upsertActor(actor: Actor, anonymize: boolean = false): Promise<void> {
  if (anonymize) {
    actor = anonymizeActor(actor);
  }
  // Upsert Actors
  await prisma.actor.upsert({
    where: { id: actor.id },
    update: {
      firstName: actor.firstName,
      lastName: actor.lastName,
      lastFirstName: actor.lastFirstName,
      firstLastName: actor.firstLastName,
      legalPersonName: actor.legalPersonName,
      legalEntityName: actor.legalEntityName,
      legalEntityId: actor.legalEntityId,
      actorType: actor.actorType as "LEGAL_PERSON" | "NATURAL_PERSON",
      qualityCode: actor.quality?.code || "R",
    },
    create: {
      id: actor.id,
      firstName: actor.firstName,
      lastName: actor.lastName,
      lastFirstName: actor.lastFirstName,
      firstLastName: actor.firstLastName,
      legalPersonName: actor.legalPersonName,
      legalEntityName: actor.legalEntityName,
      legalEntityId: actor.legalEntityId,
      actorType: actor.actorType as "LEGAL_PERSON" | "NATURAL_PERSON",
      qualityCode: actor.quality?.code || "R",
    },
  });
}

async function upsertCaseFile(caseFile: CaseFile, anonymize: boolean = false): Promise<boolean> {
  // caseFile.urgency and caseFile.mainDefender are optional
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

  // Upsert Quality for actors
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

  // Upsert LegalEntityDivision
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

  // Upsert Urgency
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

  // Upsert Status
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

  // Upsert ConclusionOperativePart if needed
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

  // Upsert Conclusion if needed
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

  // Upsert Actors

  await upsertActor(caseFile.mainClaimant, anonymize);
  if (caseFile.mainDefender) {
    await upsertActor(caseFile.mainDefender, anonymize);
  }

  // Upsert Hearing if needed
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

  // Upsert CaseFile
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

  // if case-file is

  return true;
}

function parseArgs(): Args {
  const args: Args = {
    jurisdiction: "TA069", // Tribunal Administratif du Rhône
    page: 0,
    size: 30,
    sort: undefined,
    all: false,
    legalEntityDivisionIds: [2488], // DDETS (ex-DRDJSCS1)
    anonymize: false,
  };

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
      args.legalEntityDivisionIds = process.argv[++i].split(",").map(Number); // split by comma and convert to numbers
    } else if (arg === "--anonymize") {
      args.anonymize = true;
    }
  }

  return args;
}

async function main(): Promise<number> {
  const args = parseArgs();

  // get jurisdiction from args
  const jurisdiction = args.jurisdiction;
  const username = getEnv(`${jurisdiction}_TELERECOURS_USERNAME`);
  const password = getEnv(`${jurisdiction}_TELERECOURS_PASSWORD`);

  const client = getTelerecoursCaseFileClient({
    username,
    password,
  });

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
      console.error("  Available keys:", Object.keys(response).slice(0, 10).join(", "));
      return 2;
    }

    const pageInfo = response.page as PageInfo | undefined;
    if (pageInfo && typeof pageInfo === "object") {
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
        if (upserted) {
          upsertCount++;
        } else {
          skippedCaseFileNumbers.push(item.caseFileNumber);
        }
      } catch (error) {
        console.error(
          `✗ Failed to upsert case file ${item.caseFileNumber}:`,
          error instanceof Error ? error.message : String(error),
        );
        failedCaseFileNumbers.push(item.caseFileNumber);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (totalPages === null || pageIndex + 1 >= totalPages) {
      break;
    }
    pageIndex += 1;
  }

  if (totalProcessed === 0) {
    console.error("⚠ No case files retrieved.");
    return 2;
  }

  console.log(
    `✓ ${upsertCount}/${totalProcessed} case files upserted ` +
      `(${skippedCaseFileNumbers.length} skipped, ${failedCaseFileNumbers.length} failed).`,
  );
  if (skippedCaseFileNumbers.length > 0) {
    console.log(`  skipped: ${skippedCaseFileNumbers.join(", ")}`);
  }
  if (failedCaseFileNumbers.length > 0) {
    console.log(`  failed: ${failedCaseFileNumbers.join(", ")}`);
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
