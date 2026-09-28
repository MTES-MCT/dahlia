export const COMED_USAGE = `Usage: pnpm comed:decisions -- [options]

Repère les décisions de la commission de médiation (COMED) parmi les pièces
jointes, à partir du nom et de la famille de pièce.

  --export-csv <fichier>   Écrit le résultat (une pièce par ligne) dans un fichier CSV.
  --help, -h               Affiche cette aide.
`;

export interface ComedCliArgs {
  exportCsv?: string;
  help: boolean;
}

// Parse process.argv for the COMED-decision CLI. Pure function: no environment
// access, no I/O.
export function parseComedArgs(argv: string[] = process.argv): ComedCliArgs {
  const args: ComedCliArgs = { exportCsv: undefined, help: false };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      // pnpm forwards the option separator (`pnpm comed:decisions -- --export-csv …`).
    } else if (arg === "--export-csv" && i + 1 < argv.length) {
      args.exportCsv = argv[++i];
    } else if (arg === "--export-csv") {
      throw new Error("Missing value for --export-csv.");
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}
