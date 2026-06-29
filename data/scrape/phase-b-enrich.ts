import { describeError, sleep } from "../telerecours/http";
import { enrichCaseFile } from "../persistence/enrich-case-file";
import { EXCLUDED_ENRICHMENT_STATUS_LABELS, enrichmentTargetsWhere } from "./where";
import type { Args, ScrapeDeps } from "./pipeline";

const DEFAULT_RATE_LIMIT_MS = 150;

// ───── Phase B: enrich each active case file (detail, hearings, events, files) ─────

export async function phaseB(
  args: Args,
  deps: ScrapeDeps,
): Promise<{ enriched: number; failed: number; targetCount: number }> {
  const { prisma, client } = deps;
  const rateLimitMs = deps.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  console.log(
    `\n══ Phase B — enrichissement des dossiers actifs (hors ${EXCLUDED_ENRICHMENT_STATUS_LABELS.map((l) => `"${l}"`).join(" et ")}) ══`,
  );

  const targets = await prisma.caseFile.findMany({
    where: enrichmentTargetsWhere(args),
    select: { caseFileNumber: true },
    orderBy: { lastStatusDate: "desc" },
  });

  console.log(`→ ${targets.length} dossiers cibles trouvés en DB.`);

  let enriched = 0;
  let failed = 0;
  for (const { caseFileNumber } of targets) {
    try {
      console.log(`→ Enrichissement ${caseFileNumber}…`);
      await enrichCaseFile(
        prisma,
        client,
        caseFileNumber,
        args.jurisdiction,
        args.anonymize,
        args.updatePieceNumbers,
      );
      enriched++;
    } catch (error) {
      console.error(`✗ Phase B failed for ${caseFileNumber}: ${describeError(error)}`);
      failed++;
    }
    await sleep(rateLimitMs);
  }

  console.log(`✓ Phase B : ${enriched}/${targets.length} dossiers enrichis (${failed} échec(s)).`);
  return { enriched, failed, targetCount: targets.length };
}
