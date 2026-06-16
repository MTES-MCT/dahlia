import { describeError, getTelerecoursCaseFileClient } from "./telerecours-client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { CaseFile, RelatedCaseFileSummary } from "./interfaces";
import { enrichCaseFile, upsertCaseFile } from "./enrich-case-file";

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
    // Default: anonymize unless running against the prod environment.
    anonymize: process.env.ENVIRONMENT !== "production",
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
): Promise<{ processed: number; upserted: number; seen: string[] }> {
  console.log(`\n══ Phase A — scrape liste /api/case-file (${args.jurisdiction}) ══`);

  let pageIndex = args.page;
  let totalPages: number | null = null;
  let totalElements: number | null = null;
  let totalProcessed = 0;
  let upsertCount = 0;
  const skippedCaseFileNumbers: string[] = [];
  const failedCaseFileNumbers: string[] = [];
  // Every case file number returned by the list, regardless of upsert outcome:
  // these still exist in Telerecours and must NOT be marked deleted (phase A.5).
  const seen = new Set<string>();

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
      seen.add(item.caseFileNumber);

      try {
        const upserted = await upsertCaseFile(prisma, item as CaseFile, args.anonymize);
        if (upserted) upsertCount++;
        else skippedCaseFileNumbers.push(item.caseFileNumber);
      } catch (error) {
        console.error(
          `✗ Failed to upsert case file ${item.caseFileNumber}: ${describeError(error)}`,
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
  return { processed: totalProcessed, upserted: upsertCount, seen: [...seen] };
}

// ───── Phase A.5 : reconciliation (soft delete) ─────

// Mark as deleted every case file present in DB within the scraped perimeter
// but absent from the list returned by phase A. The perimeter must mirror the
// scrape scope:
//   - always restricted to the scraped legalEntityDivisionIds;
//   - without --all the list is fetched with onlyEnrolled=true, which maps to
//     the "Inscrit au rôle d'une audience" status, so the perimeter is also
//     restricted to that status (a case file that has since left that status is
//     no longer enrolled and is legitimately treated as out of scope).
async function reconcileDeleted(args: Args, seen: string[]): Promise<number> {
  console.log(`\n══ Phase A.5 — réconciliation (dossiers absents marqués supprimés) ══`);

  const result = await prisma.caseFile.updateMany({
    where: {
      assignedToLegalEntityDivisionId: { in: args.legalEntityDivisionIds },
      ...(args.all ? {} : { lastStatus: { label: TARGET_STATUS_LABEL } }),
      caseFileNumber: { notIn: seen },
      isDeleted: false,
    },
    data: { isDeleted: true },
  });

  console.log(`✓ Phase A.5 : ${result.count} dossier(s) marqué(s) supprimé(s).`);
  return result.count;
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
      isDeleted: false,
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
      await enrichCaseFile(prisma, client, caseFileNumber, args.jurisdiction, args.anonymize);
      enriched++;
    } catch (error) {
      console.error(`✗ Phase B failed for ${caseFileNumber}: ${describeError(error)}`);
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
      isDeleted: false,
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
      console.error(`✗ Phase C failed for ${caseFileNumber}: ${describeError(error)}`);
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

  await reconcileDeleted(args, a.seen);

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
    console.error(`Fatal error: ${describeError(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
