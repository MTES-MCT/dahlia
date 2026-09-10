import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { toClassificationCsv } from "../classification/classification-csv";
import { classifyCaseFiles, logClassificationStats } from "../classification/classify-case-files";
import { CLASSIFY_USAGE, parseClassifyArgs } from "./parse-classify-args";

// CLI entrypoint: classify the case files of a jurisdiction from their scraped
// text (title, decision) using the rule engine in data/classification.
async function main(): Promise<number> {
  const args = parseClassifyArgs();
  if (args.help) {
    console.log(CLASSIFY_USAGE);
    return 1;
  }

  console.log("--------------------------------------------------");
  console.log("CLASSIFICATION DES DOSSIERS");
  console.log("  - jurisdiction:", args.jurisdiction ?? "(toutes)");
  console.log("  - legalEntityDivisionIds:", args.legalEntityDivisionIds);
  console.log("  - overwrite:", args.overwrite);
  console.log("  - dryRun:", args.dryRun);
  console.log("  - exportCsv:", args.exportCsv ?? "(non)");
  console.log("--------------------------------------------------");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const stats = await classifyCaseFiles(prisma, args);
    logClassificationStats(stats, args.dryRun);
    if (args.exportCsv) {
      writeFileSync(args.exportCsv, toClassificationCsv(stats.changes, stats.unmatched), "utf8");
      console.log(
        `→ Export CSV : ${stats.changes.length} dossiers classés et ${stats.unmatched.length} ` +
          `non reconnus écrits dans ${args.exportCsv}`,
      );
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
