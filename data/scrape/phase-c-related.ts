import { PrismaClient } from "@prisma/client";
import { describeError, sleep } from "../telerecours/http";
import { TelerecoursClient } from "../telerecours/client.interface";
import type { CaseFileKey } from "../persistence/case-file-key";
import { scrapedPerimeterWhere } from "./where";
import type { Args, ScrapeDeps } from "./pipeline";

const DEFAULT_RATE_LIMIT_MS = 100;

// Create a RelatedCaseFile link for every accessible related case file already
// present in DB. Related files absent from the DB are counted as "orphans" and
// skipped (we only link to dossiers we actually scraped). The related report is
// scoped to the court, so related case files share the source's jurisdictionCode.
// With `force`, links stored for the source but absent from the report are deleted.
export async function linkRelatedCaseFiles(
  prisma: PrismaClient,
  client: TelerecoursClient,
  key: CaseFileKey,
  jurisdiction: string,
  force: boolean = false,
): Promise<{ linked: number; orphans: number }> {
  const { jurisdictionCode, caseFileNumber } = key;
  const report = await client.getCaseFileRelatedReport(caseFileNumber, jurisdiction);
  const related = report.accessibleCaseFiles ?? [];

  let linked = 0;
  let orphans = 0;
  for (const item of related) {
    if (item.caseFileNumber === caseFileNumber) continue;
    const target = await prisma.caseFile.findUnique({
      where: {
        jurisdictionCode_caseFileNumber: { jurisdictionCode, caseFileNumber: item.caseFileNumber },
      },
      select: { caseFileNumber: true },
    });
    if (!target) {
      console.warn(`  ⚠ ${caseFileNumber} → ${item.caseFileNumber}: dossier lié absent en DB`);
      orphans++;
      // FIXME: We get the object following the structure RelatedCaseFileSummary
      // Should we upsert the object or try to get it from getCaseFileDetail route ?
      // Be careful to the new account without the right to see non DDTES case files.
      continue;
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
  return { linked, orphans };
}

// ───── Phase C: links between case files (related-case-files) ─────

export async function phaseC(
  args: Args,
  deps: ScrapeDeps,
): Promise<{ linked: number; orphans: number; targetCount: number }> {
  const { prisma, client } = deps;
  const rateLimitMs = deps.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  console.log(`\n══ Phase C — liens entre dossiers (related-case-files) ══`);

  const targets = await prisma.caseFile.findMany({
    where: scrapedPerimeterWhere(args, args.enrich !== "all"),
    select: { jurisdictionCode: true, caseFileNumber: true },
  });

  let linkedTotal = 0;
  let orphansTotal = 0;
  for (const key of targets) {
    const { caseFileNumber } = key;
    try {
      const { linked, orphans } = await linkRelatedCaseFiles(
        prisma,
        client,
        key,
        args.jurisdiction,
        args.force,
      );
      linkedTotal += linked;
      orphansTotal += orphans;
    } catch (error) {
      console.error(`✗ Phase C failed for ${caseFileNumber}: ${describeError(error)}`);
    }
    await sleep(rateLimitMs);
  }

  console.log(
    `✓ Phase C : ${linkedTotal} liens créés, ${orphansTotal} dossiers liés absents de la DB.`,
  );
  return { linked: linkedTotal, orphans: orphansTotal, targetCount: targets.length };
}
