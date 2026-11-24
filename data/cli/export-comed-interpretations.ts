import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  buildComedDecisionRows,
  loadComedInterpretations,
  toComedInterpretationCsv,
} from "../comed/export-comed-interpretations";

const USAGE = `Usage: pnpm export:comed -- --jurisdiction <code> [--output <fichier>]

Exporte en CSV les décisions COMED interprétées par DocumentIA (une ligne par
décision distincte, pivot : numero_recours + date_decision).

  --jurisdiction <code>   Juridiction Dahlia à exporter (ex. TA069, TA069bis), comme
                          scrape:telerecours. Obligatoire.
  --output <fichier>      Fichier CSV. Défaut : comed-decisions-<code>-AAAA-MM-JJ.csv
  --help, -h              Affiche cette aide.
`;

interface ExportComedArgs {
  jurisdiction: string | null;
  output: string | null;
  help: boolean;
}

export function parseExportComedArgs(argv: string[] = process.argv): ExportComedArgs {
  const args: ExportComedArgs = { jurisdiction: null, output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const nextValue = (): string => {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      return value;
    };
    if (arg === "--") continue;
    else if (arg === "--jurisdiction") args.jurisdiction = nextValue();
    else if (arg === "--output") args.output = nextValue();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main(): Promise<number> {
  const args = parseExportComedArgs();
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (!args.jurisdiction) {
    console.error(USAGE);
    return 1;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const interpretations = await loadComedInterpretations(prisma, args.jurisdiction);
    const rows = buildComedDecisionRows(interpretations);
    const output =
      args.output ??
      `comed-decisions-${args.jurisdiction}-${new Date().toISOString().slice(0, 10)}.csv`;
    writeFileSync(output, toComedInterpretationCsv(rows), "utf8");
    const caseFiles = new Set(rows.map((row) => row.caseFileNumber)).size;
    console.log(
      `→ ${interpretations.length} pièces COMED, ${rows.length} décisions distinctes, ` +
        `${caseFiles} dossiers, ${rows.filter((row) => row.divergentParameters.length).length} ` +
        `décisions aux paramètres divergents → ${output}`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Fatal error:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
