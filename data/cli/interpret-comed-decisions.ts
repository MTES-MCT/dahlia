import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDocumentIaClient, documentIaConfigFromEnv } from "../document-ia/client";
import { logApplyComedStats } from "../comed/apply-comed-decisions";
import { jurisdictionInstanceWhere, telerecoursCredentials } from "../jurisdiction-instance";
import {
  comedCaseFileScope,
  interpretComedDecisions,
  logInterpretComedStats,
} from "../comed/interpret-comed-decisions";
import { EXCLUDED_ENRICHMENT_STATUS_LABELS } from "../scrape/where";
import { getTelerecoursCaseFileClient } from "../telerecours/client";
import type { TelerecoursClient } from "../telerecours/client.interface";
import { describeError } from "../telerecours/http";
import { INTERPRET_COMED_USAGE, parseInterpretComedArgs } from "./parse-interpret-comed-args";

// CLI entrypoint: find COMED-decision candidates, interpret them with DocumentIA,
// store the results in attached_file_interpretations, then copy the confirmed
// decisions onto the case files and pièces (unless --dry-run).
async function main(): Promise<number> {
  const args = parseInterpretComedArgs();
  if (args.help) {
    console.log(INTERPRET_COMED_USAGE);
    return 0;
  }

  // Fail fast on a missing configuration, before loading anything.
  const documentIa = createDocumentIaClient(documentIaConfigFromEnv());

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const clients = new Map<string, TelerecoursClient>();
  const getTelerecoursClient = (shortName: string): TelerecoursClient => {
    let client = clients.get(shortName);
    if (!client) {
      client = getTelerecoursCaseFileClient(telerecoursCredentials(shortName));
      clients.set(shortName, client);
    }
    return client;
  };

  try {
    const dryRun = args.dryRun ?? false;
    const stats = await interpretComedDecisions(prisma, {
      filter: {
        caseFile: {
          ...comedCaseFileScope(args.enrich, EXCLUDED_ENRICHMENT_STATUS_LABELS),
          ...(args.jurisdiction ? jurisdictionInstanceWhere(args.jurisdiction) : {}),
        },
      },
      force: args.forceDocumentIa,
      documentIa,
      getTelerecoursClient,
      // Each case file is updated as soon as its pièces are interpreted.
      apply: { dryRun, overwrite: args.forceDocumentIa },
    });
    logInterpretComedStats(stats);
    if (stats.applied) logApplyComedStats(stats.applied, dryRun);
    return stats.failed > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`Fatal error: ${describeError(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
