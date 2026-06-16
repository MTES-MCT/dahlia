import { describeError, getTelerecoursCaseFileClient } from "./telerecours-client";
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

interface Args {
  jurisdiction: string;
  encodedFileId: string;
  output?: string;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function parseArgs(): Args {
  const args: Partial<Args> = {
    jurisdiction: "TA069",
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--jurisdiction" && i + 1 < process.argv.length) {
      args.jurisdiction = process.argv[++i];
    } else if (arg === "--encodedFileId" && i + 1 < process.argv.length) {
      args.encodedFileId = process.argv[++i];
    } else if (arg === "--output" && i + 1 < process.argv.length) {
      args.output = process.argv[++i];
    }
  }

  if (!args.encodedFileId) {
    throw new Error(
      "Missing required argument: --encodedFileId <id>\n" +
        "Usage: pnpm download:dev --encodedFileId <id> " +
        "[--jurisdiction TA069] [--output ./chemin/fichier]",
    );
  }

  return args as Args;
}

// Avoid path separators / forbidden characters in a file name.
function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}

async function main(): Promise<number> {
  const args = parseArgs();
  const username = getEnv(`${args.jurisdiction}_TELERECOURS_USERNAME`);
  const password = getEnv(`${args.jurisdiction}_TELERECOURS_PASSWORD`);
  const client = getTelerecoursCaseFileClient({ username, password });

  console.log(
    `→ Téléchargement de la pièce ${args.encodedFileId} (jurisdiction=${args.jurisdiction})…`,
  );

  const { data, fileName, mimeType } = await client.downloadFile(
    args.encodedFileId,
    args.jurisdiction,
  );

  // Destination: --output if provided (file or directory), otherwise the name
  // from Content-Disposition, defaulting to the encodedFileId, in the current
  // directory.
  const defaultName = sanitizeFileName(fileName ?? args.encodedFileId);
  const outputPath = args.output
    ? args.output.endsWith("/")
      ? join(args.output, defaultName)
      : args.output
    : defaultName;
  const resolved = resolve(outputPath);

  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, data);

  console.log(
    `✓ Fichier écrit : ${resolved} (${data.byteLength} octets` +
      (mimeType ? `, ${mimeType}` : "") +
      `)`,
  );
  return 0;
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
