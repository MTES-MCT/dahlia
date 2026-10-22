import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FAVORITE_ON_CREATE_FAMILY_TYPE } from "../persistence/enrich-case-file";

// One-off backfill: flag every "Requête" pièce already in DB as favorite, like
// the scraper does for newly created ones. Already-flagged pièces are skipped.
//
//   pnpm flag:requete-favorites -- [--jurisdiction TA069] [--dry-run]

export type FlagRequeteFavoritesArgs = { jurisdiction: string | null; dryRun: boolean };

export function parseFlagRequeteFavoritesArgs(argv: string[]): FlagRequeteFavoritesArgs {
  const index = argv.indexOf("--jurisdiction");
  const jurisdiction = index >= 0 ? (argv[index + 1] ?? null) : null;
  if (index >= 0 && (!jurisdiction || jurisdiction.startsWith("--"))) {
    throw new Error("--jurisdiction attend un code de juridiction (ex. TA069).");
  }
  return { jurisdiction, dryRun: argv.includes("--dry-run") };
}

// Returns the number of pièces flagged (or that would be, in dry-run).
export async function flagRequeteFavorites(
  prisma: PrismaClient,
  { jurisdiction, dryRun }: FlagRequeteFavoritesArgs,
): Promise<number> {
  const where = {
    fileFamilyTypeCode: FAVORITE_ON_CREATE_FAMILY_TYPE,
    isFavorite: false,
    ...(jurisdiction ? { jurisdictionCode: jurisdiction } : {}),
  };
  if (dryRun) {
    return prisma.attachedFile.count({ where });
  }
  const { count } = await prisma.attachedFile.updateMany({ where, data: { isFavorite: true } });
  return count;
}

async function main(): Promise<number> {
  const args = parseFlagRequeteFavoritesArgs(process.argv.slice(2));
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const count = await flagRequeteFavorites(prisma, args);
    const scope = args.jurisdiction ? ` (${args.jurisdiction})` : "";
    console.log(
      args.dryRun
        ? `→ --dry-run : ${count} pièce(s) « Requête »${scope} seraient marquées en favori.`
        : `✓ ${count} pièce(s) « Requête »${scope} marquées en favori.`,
    );
    return 0;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}
