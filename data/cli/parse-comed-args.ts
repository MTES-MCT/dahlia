export const COMED_USAGE = `Usage: pnpm find-comed-decisions -- [options]

Repère les décisions de la commission de médiation (COMED) parmi les pièces
jointes, à partir du nom et de la famille de pièce.

  --export-csv <fichier>   Écrit le résultat (une pièce par ligne) dans un fichier CSV.
  --export-files           Télécharge chaque pièce COMED depuis Télérecours dans
                           un dossier comed-files-AAAA-MM-JJ (répertoire courant).
  --jurisdiction <code>    Limite à un tribunal (ex. TA069). Défaut : toutes les juridictions.
  --help, -h               Affiche cette aide.
`;

export interface ComedCliArgs {
  exportCsv?: string;
  exportFiles: boolean;
  jurisdiction: string | null;
  help: boolean;
}

// Parse process.argv for the COMED-decision CLI. Pure function: no environment
// access, no I/O.
export function parseComedArgs(argv: string[] = process.argv): ComedCliArgs {
  const args: ComedCliArgs = {
    exportCsv: undefined,
    exportFiles: false,
    jurisdiction: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      // pnpm forwards the option separator (`pnpm find-comed-decisions -- --export-csv …`).
    } else if (arg === "--export-csv" && i + 1 < argv.length) {
      args.exportCsv = argv[++i];
    } else if (arg === "--export-csv") {
      throw new Error("Missing value for --export-csv.");
    } else if (arg === "--export-files") {
      args.exportFiles = true;
    } else if (arg === "--jurisdiction") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--jurisdiction attend un code de juridiction (ex. TA069).");
      }
      args.jurisdiction = value;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}
