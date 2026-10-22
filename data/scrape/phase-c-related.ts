import { PrismaClient } from "@prisma/client";
import { describeError, sleep } from "../telerecours/http";
import { TelerecoursClient } from "../telerecours/client.interface";
import type { CaseFileKey } from "../persistence/case-file-key";
import { enrichCaseFile, upsertCaseFileDetail } from "../persistence/enrich-case-file";
import { upsertCaseFile } from "../persistence/upsert-case-file";
import { upsertJurisdiction } from "../persistence/upsert-jurisdiction";
import { scrapedPerimeterWhere } from "./where";
import type { Args, ScrapeDeps } from "./pipeline";

const DEFAULT_RATE_LIMIT_MS = 100;

// How a related case file absent from the DB is imported before being linked.
// With `enrich`, its hearings, events, actors and attached files are fetched too.
export interface RelatedImportOptions {
  anonymize: boolean;
  enrich: boolean;
  updatePieceNumbers: boolean;
  updatePieceName: boolean;
}

const DEFAULT_RELATED_IMPORT: RelatedImportOptions = {
  anonymize: false,
  enrich: false,
  updatePieceNumbers: false,
  updatePieceName: false,
};

// Fetch a related case file absent from the DB and upsert it. Returns false
// when the detail lacks the fields required to create the case file.
async function importRelatedCaseFile(
  prisma: PrismaClient,
  client: TelerecoursClient,
  caseFileNumber: string,
  jurisdiction: string,
  options: RelatedImportOptions,
): Promise<boolean> {
  if (options.enrich) {
    await enrichCaseFile(
      prisma,
      client,
      caseFileNumber,
      jurisdiction,
      options.anonymize,
      options.updatePieceNumbers,
      false,
      options.updatePieceName,
    );
    return true;
  }
  const resolvedJurisdiction = await upsertJurisdiction(prisma, jurisdiction);
  const detail = await client.getCaseFileDetail(caseFileNumber, jurisdiction);
  const created = await upsertCaseFile(prisma, detail, options.anonymize, resolvedJurisdiction);
  if (!created) return false;
  await upsertCaseFileDetail(
    prisma,
    { jurisdictionCode: resolvedJurisdiction.jurisdictionCode, caseFileNumber },
    detail,
  );
  return true;
}

// Create a RelatedCaseFile link for every accessible related case file. A
// related file absent from the DB is first fetched from Telerecours and
// upserted (see importRelatedCaseFile); when that fails (no access, missing
// fields…) it is counted as an "orphan" and skipped. The related report is
// scoped to the court, so related case files share the source's jurisdictionCode.
// With `force`, links stored for the source but absent from the report are deleted.
export async function linkRelatedCaseFiles(
  prisma: PrismaClient,
  client: TelerecoursClient,
  key: CaseFileKey,
  jurisdiction: string,
  force: boolean = false,
  importOptions: RelatedImportOptions = DEFAULT_RELATED_IMPORT,
): Promise<{ linked: number; orphans: number; imported: number }> {
  const { jurisdictionCode, caseFileNumber } = key;
  const report = await client.getCaseFileRelatedReport(caseFileNumber, jurisdiction);
  const related = report.accessibleCaseFiles ?? [];

  let linked = 0;
  let orphans = 0;
  let imported = 0;
  for (const item of related) {
    if (item.caseFileNumber === caseFileNumber) continue;
    const target = await prisma.caseFile.findUnique({
      where: {
        jurisdictionCode_caseFileNumber: { jurisdictionCode, caseFileNumber: item.caseFileNumber },
      },
      select: { caseFileNumber: true },
    });
    if (!target) {
      let created = false;
      try {
        created = await importRelatedCaseFile(
          prisma,
          client,
          item.caseFileNumber,
          jurisdiction,
          importOptions,
        );
      } catch (error) {
        console.warn(
          `  ⚠ ${caseFileNumber} → ${item.caseFileNumber}: import du dossier lié impossible ` +
            `(${describeError(error)})`,
        );
      }
      if (!created) {
        orphans++;
        continue;
      }
      console.log(`  + ${caseFileNumber} → ${item.caseFileNumber}: dossier lié importé`);
      imported++;
    }
    await prisma.relatedCaseFile.upsert({
      where: {
        jurisdictionCode_caseFileNumber_relatedCaseFileNumber: {
          ...key,
          relatedCaseFileNumber: item.caseFileNumber,
        },
      },
      update: {},
      create: {
        ...key,
        relatedCaseFileNumber: item.caseFileNumber,
      },
    });
    linked++;
  }

  if (force) {
    const reported = related.map((item) => item.caseFileNumber);
    const { count } = await prisma.relatedCaseFile.deleteMany({
      where: { ...key, relatedCaseFileNumber: { notIn: reported } },
    });
    if (count > 0) {
      console.log(`  ⚑ ${caseFileNumber}: ${count} lien(s) entre dossiers supprimé(s) (--force)`);
    }
  }
  return { linked, orphans, imported };
}

// ───── Phase C: links between case files (related-case-files) ─────

export async function phaseC(
  args: Args,
  deps: ScrapeDeps,
): Promise<{ linked: number; orphans: number; imported: number; targetCount: number }> {
  const { prisma, client } = deps;
  const importOptions: RelatedImportOptions = {
    anonymize: args.anonymize,
    enrich: args.enrich === "all",
    updatePieceNumbers: args.updatePieceNumbers,
    updatePieceName: args.updatePieceName,
  };
  const rateLimitMs = deps.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  console.log(`\n══ Phase C — liens entre dossiers (related-case-files) ══`);

  const targets = await prisma.caseFile.findMany({
    where: scrapedPerimeterWhere(args, args.enrich !== "all"),
    select: { jurisdictionCode: true, caseFileNumber: true },
  });

  let linkedTotal = 0;
  let orphansTotal = 0;
  let importedTotal = 0;
  for (const key of targets) {
    const { caseFileNumber } = key;
    try {
      const { linked, orphans, imported } = await linkRelatedCaseFiles(
        prisma,
        client,
        key,
        args.jurisdiction,
        args.force,
        importOptions,
      );
      linkedTotal += linked;
      orphansTotal += orphans;
      importedTotal += imported;
    } catch (error) {
      console.error(`✗ Phase C failed for ${caseFileNumber}: ${describeError(error)}`);
    }
    await sleep(rateLimitMs);
  }

  console.log(
    `✓ Phase C : ${linkedTotal} liens créés, ${importedTotal} dossiers liés importés, ` +
      `${orphansTotal} dossiers liés non importables.`,
  );
  return {
    linked: linkedTotal,
    orphans: orphansTotal,
    imported: importedTotal,
    targetCount: targets.length,
  };
}
