import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  applyDahliaNameUpdate,
  DAHLIA_NAME_FIELD,
  plannedAutoRename,
  USER_ORIGIN,
} from "../persistence/attached-file-dahlia-name";

// Rename the pièces already in DB from their Telerecours file name, with the
// same rules as the scraper's --update-piece-name / --force-update-piece-name,
// without calling Telerecours. Each rename is logged in `field_changes`
// (origin "script").
//
//   pnpm update:piece-names -- [--jurisdiction TA069] [--dry-run] [--force-update-piece-name]

export const UPDATE_PIECE_NAMES_USAGE = `Usage: pnpm update:piece-names -- [options]

  --jurisdiction <code>        Limite aux pièces d'un tribunal (ex. TA069). Défaut : tous.
  --dry-run                    Affiche le nombre de pièces à renommer, sans rien modifier.
  --force-update-piece-name    Renomme aussi les pièces déjà nommées (par le scraper ou un
                               script), sauf celles qu'un utilisateur a renommées.
  --verbose                    Affiche une ligne par pièce renommée.
  --help, -h                   Affiche cette aide.
`;

export type UpdatePieceNamesArgs = {
  jurisdiction: string | null;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  help: boolean;
};

export function parseUpdatePieceNamesArgs(argv: string[]): UpdatePieceNamesArgs {
  const args: UpdatePieceNamesArgs = {
    jurisdiction: null,
    dryRun: false,
    force: false,
    verbose: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--jurisdiction") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--jurisdiction attend un code de juridiction (ex. TA069).");
      }
      args.jurisdiction = value;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force-update-piece-name") {
      args.force = true;
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg !== "--") {
      throw new Error(`Argument inconnu : ${arg}. Utiliser --help pour la liste des options.`);
    }
  }
  return args;
}

const BATCH_SIZE = 500;

export type UpdatePieceNamesStats = { scanned: number; renamed: number };

// Returns the number of pièces scanned and renamed (or that would be, in dry-run).
export async function updatePieceNames(
  prisma: PrismaClient,
  { jurisdiction, dryRun, force, verbose }: Omit<UpdatePieceNamesArgs, "help">,
): Promise<UpdatePieceNamesStats> {
  // Without force, only unnamed pièces can be renamed.
  const where: Prisma.AttachedFileWhereInput = {
    ...(jurisdiction ? { jurisdictionCode: jurisdiction } : {}),
    ...(force ? {} : { OR: [{ dahliaName: null }, { dahliaName: "" }] }),
  };
  const stats: UpdatePieceNamesStats = { scanned: 0, renamed: 0 };
  let cursor: { jurisdictionCode: string; encodedFileId: string } | undefined;

  for (;;) {
    // Keyset pagination: renamed pièces leave the default filter, so an offset
    // would skip rows.
    const after: Prisma.AttachedFileWhereInput = cursor
      ? {
          OR: [
            { jurisdictionCode: { gt: cursor.jurisdictionCode } },
            {
              jurisdictionCode: cursor.jurisdictionCode,
              encodedFileId: { gt: cursor.encodedFileId },
            },
          ],
        }
      : {};
    const pieces = await prisma.attachedFile.findMany({
      where: { AND: [where, after] },
      select: {
        jurisdictionCode: true,
        encodedFileId: true,
        fileName: true,
        fileTypeLabel: true,
        fileFamilyTypeCode: true,
        dahliaName: true,
      },
      orderBy: [{ jurisdictionCode: "asc" }, { encodedFileId: "asc" }],
      take: BATCH_SIZE,
    });
    if (pieces.length === 0) break;
    stats.scanned += pieces.length;

    const userRenamed = force ? await userRenamedOf(prisma, pieces) : new Set<string>();
    for (const piece of pieces) {
      const newName = plannedAutoRename(piece, userRenamed.has(pieceKey(piece)), force);
      if (!newName) continue;
      stats.renamed++;
      if (verbose || dryRun) {
        console.log(
          `  ${dryRun ? "[dry-run] " : ""}${piece.jurisdictionCode} ${piece.encodedFileId}: ` +
            `${JSON.stringify(piece.dahliaName)} → ${JSON.stringify(newName)}`,
        );
      }
      if (!dryRun) {
        await applyDahliaNameUpdate(prisma, piece, newName, "script");
      }
    }

    const last = pieces[pieces.length - 1];
    cursor = { jurisdictionCode: last.jurisdictionCode, encodedFileId: last.encodedFileId };
    if (pieces.length < BATCH_SIZE) break;
  }
  return stats;
}

function pieceKey(piece: { jurisdictionCode: string; encodedFileId: string }): string {
  return `${piece.jurisdictionCode}\u0000${piece.encodedFileId}`;
}

// Pièces of the batch that a user renamed at least once, in one query.
async function userRenamedOf(
  prisma: PrismaClient,
  pieces: { jurisdictionCode: string; encodedFileId: string }[],
): Promise<Set<string>> {
  const rows = await prisma.fieldChange.findMany({
    where: {
      model: "AttachedFile",
      field: DAHLIA_NAME_FIELD,
      origin: USER_ORIGIN,
      OR: pieces.map((piece) => ({
        jurisdictionCode: piece.jurisdictionCode,
        modelId: piece.encodedFileId,
      })),
    },
    distinct: ["jurisdictionCode", "modelId"],
    select: { jurisdictionCode: true, modelId: true },
  });
  return new Set(
    rows.map((row) =>
      pieceKey({ jurisdictionCode: row.jurisdictionCode, encodedFileId: row.modelId }),
    ),
  );
}

async function main(): Promise<number> {
  const args = parseUpdatePieceNamesArgs(process.argv.slice(2));
  if (args.help) {
    console.log(UPDATE_PIECE_NAMES_USAGE);
    return 0;
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const { scanned, renamed } = await updatePieceNames(prisma, args);
    const scope = args.jurisdiction ? ` (${args.jurisdiction})` : "";
    console.log(
      args.dryRun
        ? `→ --dry-run : ${renamed}/${scanned} pièce(s)${scope} seraient renommées.`
        : `✓ ${renamed}/${scanned} pièce(s)${scope} renommées.`,
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
