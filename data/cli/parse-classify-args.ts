import type { ClassifyCaseFilesOptions } from "../classification/classify-case-files";
import { parseDivisionIds } from "./parse-args";

export const CLASSIFY_USAGE = `Usage: pnpm classify:case-files -- --jurisdiction <code> [options]

  --jurisdiction <code>            Code juridiction (ex. TA069). Obligatoire sauf --all-jurisdictions.
  --all-jurisdictions              Traite tous les dossiers, toutes juridictions confondues.
  --legalEntityDivisionIds <ids>   Filtre de divisions, séparées par des virgules.
  --overwrite                      Réécrit aussi les caractéristiques déjà renseignées.
  --dry-run                        Affiche ce qui serait écrit, sans rien modifier.
  --verbose                        Affiche une ligne par dossier modifié.
`;

export interface ClassifyCliArgs extends ClassifyCaseFilesOptions {
  // True when --help was asked, or when neither --jurisdiction nor
  // --all-jurisdictions was given (guard against classifying every
  // jurisdiction by accident).
  help: boolean;
}

// Parse process.argv for the standalone classification CLI. Pure function: no
// environment access, no I/O.
export function parseClassifyArgs(argv: string[] = process.argv): ClassifyCliArgs {
  const args: ClassifyCliArgs = {
    jurisdiction: undefined,
    legalEntityDivisionIds: [],
    overwrite: false,
    dryRun: false,
    verbose: false,
    help: false,
  };
  let allJurisdictions = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--jurisdiction" && i + 1 < argv.length) {
      args.jurisdiction = argv[++i];
    } else if (arg === "--all-jurisdictions") {
      allJurisdictions = true;
    } else if (arg === "--legalEntityDivisionIds" && i + 1 < argv.length) {
      args.legalEntityDivisionIds = parseDivisionIds(argv[++i]);
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  if (allJurisdictions) args.jurisdiction = undefined;
  if (!allJurisdictions && !args.jurisdiction) args.help = true;

  return args;
}
