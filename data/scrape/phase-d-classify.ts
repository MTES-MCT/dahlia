import {
  classifyCaseFiles,
  logClassificationStats,
  type ClassifyCaseFilesStats,
} from "../classification/classify-case-files";
import type { Args, ScrapeDeps } from "./pipeline";

// ───── Phase D: deduce litigationType / rightType / summary from the scraped text ─────
// Runs the rule engine (data/classification) over the case files of the scraped
// perimeter. Enabled with --classify; by default it only fills empty fields, so
// values entered by users are preserved unless --classify-overwrite is passed.
export async function phaseD(args: Args, deps: ScrapeDeps): Promise<ClassifyCaseFilesStats> {
  console.log(
    `\n══ Phase D — classification des dossiers (${args.classifyOverwrite ? "réécriture des champs existants" : "champs vides uniquement"}) ══`,
  );

  const stats = await classifyCaseFiles(deps.prisma, {
    jurisdiction: args.jurisdiction,
    legalEntityDivisionIds: args.legalEntityDivisionIds,
    overwrite: args.classifyOverwrite,
  });

  logClassificationStats(stats);
  return stats;
}
