import {
  interpretComedDecisions,
  logInterpretComedStats,
  type InterpretComedStats,
} from "../comed/interpret-comed-decisions";
import type { Args, ScrapeDeps } from "./pipeline";
import { scrapedPerimeterWhere } from "./where";

// ───── Phase E: DocumentIA interpretation of the COMED decisions ─────
// Same candidates as find-comed-decisions, restricted to the scraped perimeter
// (jurisdiction, divisions, not deleted; closed dossiers only with --enrich all).
// Enabled with --document-ia; already interpreted pièces are skipped unless
// --force-document-ia.
export async function phaseE(args: Args, deps: ScrapeDeps): Promise<InterpretComedStats> {
  console.log(
    `\n══ Phase E — interprétation DocumentIA des décisions COMED` +
      `${args.forceDocumentIa ? " (réinterprétation forcée)" : ""} ══`,
  );
  if (!deps.documentIa) {
    throw new Error("Phase E : client DocumentIA non configuré.");
  }

  const stats = await interpretComedDecisions(deps.prisma, {
    filter: { caseFile: scrapedPerimeterWhere(args, args.enrich !== "all") },
    force: args.forceDocumentIa,
    documentIa: deps.documentIa,
    // The scrape runs against a single Dahlia jurisdiction: reuse its client.
    getTelerecoursClient: () => deps.client,
    rateLimitMs: deps.rateLimitMs,
  });

  logInterpretComedStats(stats);
  return stats;
}
