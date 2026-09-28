import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { toComedDecisionCsv } from "../comed/comed-decision-csv";
import {
  findComedDecisions,
  logComedDecisionStats,
  countUniqueDossiers,
} from "../comed/find-comed-decisions";
import { COMED_USAGE, parseComedArgs } from "./parse-comed-args";

// CLI entrypoint: load attached files (and their case file) through Prisma,
// classify COMED decisions in JS, optionally write the CSV export.
async function main(): Promise<number> {
  const args = parseComedArgs();
  if (args.help) {
    console.log(COMED_USAGE);
    return 0;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const decisions = await findComedDecisions(prisma);
    const nb_dossiers = await countUniqueDossiers(prisma);
    logComedDecisionStats(decisions, nb_dossiers);
    if (args.exportCsv) {
      writeFileSync(args.exportCsv, toComedDecisionCsv(decisions), "utf8");
      console.log(`→ Export CSV : ${decisions.length} pièces écrites dans ${args.exportCsv}`);
    }
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
