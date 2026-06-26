import { describeError, sleep } from "../telerecours/http";
import { upsertCaseFile } from "../persistence/upsert-case-file";
import { divisionWhere, enrichmentTargetsWhere } from "./where";
import type { Args, ScrapeDeps } from "./pipeline";

const DEFAULT_RATE_LIMIT_MS = 100;

// ───── Phase A: scrape the /api/case-file list and upsert each item ─────

export async function phaseA(
  args: Args,
  deps: ScrapeDeps,
): Promise<{ processed: number; upserted: number; seen: string[] }> {
  const { prisma, client } = deps;
  const rateLimitMs = deps.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  console.log(`\n══ Phase A — scrape liste /api/case-file (${args.jurisdiction}) ══`);

  const statusGroupIds = args.all
    ? undefined
    : await client.getInProgressStatusGroupIds(args.jurisdiction);

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

    const response = await client.getCaseFiles(
      args.jurisdiction,
      pageIndex,
      args.size,
      args.sort,
      statusGroupIds,
      args.legalEntityDivisionIds,
    );

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
        const upserted = await upsertCaseFile(prisma, item, args.anonymize);
        if (upserted) upsertCount++;
        else skippedCaseFileNumbers.push(item.caseFileNumber);
      } catch (error) {
        console.error(
          `✗ Failed to upsert case file ${item.caseFileNumber}: ${describeError(error)}`,
        );
        failedCaseFileNumbers.push(item.caseFileNumber);
      }

      await sleep(rateLimitMs);
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

// ───── Phase A.5: reconciliation (soft delete) ─────

// Mark as deleted every case file present in DB within the scraped perimeter
// but absent from the list returned by phase A. The perimeter must mirror the
// scrape scope:
//   - restricted to the scraped legalEntityDivisionIds when configured (CLI
//     arg or env var); otherwise the filter is omitted and all divisions of
//     the jurisdiction are considered;
//   - without --all the perimeter is restricted to active dossiers (status
//     groups INPROGRESS from Télérecours, excluding "Terminé").
export async function reconcileDeleted(
  args: Args,
  seen: string[],
  deps: ScrapeDeps,
): Promise<number> {
  console.log(`\n══ Phase A.5 — réconciliation (dossiers absents marqués supprimés) ══`);

  const result = await deps.prisma.caseFile.updateMany({
    where: {
      ...(args.all ? { ...divisionWhere(args), isDeleted: false } : enrichmentTargetsWhere(args)),
      caseFileNumber: { notIn: seen },
    },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  console.log(`✓ Phase A.5 : ${result.count} dossier(s) marqué(s) supprimé(s).`);
  return result.count;
}
