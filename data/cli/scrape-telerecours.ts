import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTelerecoursCaseFileClient } from "../telerecours/client";
import { describeError } from "../telerecours/http";
import { runScrape } from "../scrape/pipeline";
import { getEnv, parseArgs } from "./parse-args";

// CLI entrypoint: wire the real Prisma client and Telerecours client, then hand
// off to the pipeline. All scraping logic lives under scrape/ and persistence/.
async function main(): Promise<number> {
  const args = parseArgs();
  const username = getEnv(`${args.jurisdiction}_TELERECOURS_USERNAME`);
  const password = getEnv(`${args.jurisdiction}_TELERECOURS_PASSWORD`);
  const client = getTelerecoursCaseFileClient({ username, password });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    return await runScrape(args, { prisma, client });
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
