import { PrismaClient } from "@prisma/client";
import { describeError, sleep } from "../telerecours/http";
import { TelerecoursClient } from "../telerecours/client.interface";
import { enrichmentTargetsWhere } from "./where";
import type { Args, ScrapeDeps } from "./pipeline";

const DEFAULT_RATE_LIMIT_MS = 100;

// Create a RelatedCaseFile link for every accessible related case file already
// present in DB. Related files absent from the DB are counted as "orphans" and
// skipped (we only link to dossiers we actually scraped).
export async function linkRelatedCaseFiles(
  prisma: PrismaClient,
  client: TelerecoursClient,
  caseFileNumber: string,
  jurisdiction: string,
): Promise<{ linked: number; orphans: number }> {
  const report = await client.getCaseFileRelatedReport(caseFileNumber, jurisdiction);
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
      // FIXME: We get the object following the structure RelatedCaseFileSummary
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

// ───── Phase C: links between case files (related-case-files) ─────

export async function phaseC(
  args: Args,
  deps: ScrapeDeps,
): Promise<{ linked: number; orphans: number; targetCount: number }> {
  const { prisma, client } = deps;
  const rateLimitMs = deps.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  console.log(`\n══ Phase C — liens entre dossiers (related-case-files) ══`);

  const targets = await prisma.caseFile.findMany({
    where: enrichmentTargetsWhere(args),
    select: { caseFileNumber: true },
  });

  let linkedTotal = 0;
  let orphansTotal = 0;
  for (const { caseFileNumber } of targets) {
    try {
      const { linked, orphans } = await linkRelatedCaseFiles(
        prisma,
        client,
        caseFileNumber,
        args.jurisdiction,
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
