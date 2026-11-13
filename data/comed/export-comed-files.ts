import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { getTelerecoursCaseFileClient } from "../telerecours/client";
import type { TelerecoursClient } from "../telerecours/client.interface";
import { describeError, sleep } from "../telerecours/http";
import type { ComedDecision } from "./match-comed-decision";

const CASE_FILE_LOOKUP_BATCH = 10_000;
const DOWNLOAD_RATE_LIMIT_MS = 150;

function caseFileKey(jurisdictionCode: string, caseFileNumber: string): string {
  return `${jurisdictionCode}\0${caseFileNumber}`;
}

// Folder name requested by the COMED export CLI (local calendar date).
export function comedFilesExportDirName(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `comed-files-${year}-${month}-${day}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}

function telerecoursCredentials(shortName: string): { username: string; password: string } {
  const username = process.env[`${shortName}_TELERECOURS_USERNAME`];
  const password = process.env[`${shortName}_TELERECOURS_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Identifiants Télérecours manquants pour ${shortName} ` +
        `(${shortName}_TELERECOURS_USERNAME / _PASSWORD).`,
    );
  }
  return { username, password };
}

async function loadJurisdictionShortNames(
  prisma: PrismaClient,
  decisions: readonly { jurisdictionCode: string; caseFileNumber: string }[],
): Promise<Map<string, string>> {
  const numbersByCourt = new Map<string, Set<string>>();
  for (const decision of decisions) {
    const numbers = numbersByCourt.get(decision.jurisdictionCode) ?? new Set<string>();
    numbers.add(decision.caseFileNumber);
    numbersByCourt.set(decision.jurisdictionCode, numbers);
  }

  const shortNames = new Map<string, string>();
  for (const [jurisdictionCode, numbers] of numbersByCourt) {
    const caseFileNumbers = [...numbers];
    for (let offset = 0; offset < caseFileNumbers.length; offset += CASE_FILE_LOOKUP_BATCH) {
      const batch = caseFileNumbers.slice(offset, offset + CASE_FILE_LOOKUP_BATCH);
      const rows = await prisma.caseFile.findMany({
        where: { jurisdictionCode, caseFileNumber: { in: batch } },
        select: {
          jurisdictionCode: true,
          caseFileNumber: true,
          jurisdiction: { select: { shortName: true } },
        },
      });
      for (const row of rows) {
        const key = caseFileKey(row.jurisdictionCode, row.caseFileNumber);
        const shortName = row.jurisdiction?.shortName ?? row.jurisdictionCode;
        shortNames.set(key, shortName);
      }
    }
  }
  return shortNames;
}

function resolveExportFileName(
  decision: ComedDecision,
  telerecoursFileName: string | undefined,
  usedNames: Set<string>,
): string {
  const base = sanitizeFileName(telerecoursFileName ?? (decision.fileName || decision.encodedFileId));
  let candidate = base;
  if (usedNames.has(candidate)) {
    const ext =
      base.includes(".") && !base.endsWith(".") ? base.slice(base.lastIndexOf(".")) : "";
    const stem = ext ? base.slice(0, -ext.length) : base;
    candidate = sanitizeFileName(`${stem}_${decision.encodedFileId}${ext}`);
  }
  usedNames.add(candidate);
  return candidate;
}

export type ExportComedFilesResult = {
  exportDir: string;
  downloaded: number;
  failed: number;
};

// Download each COMED decision from Télérecours into `comed-files-YYYY-MM-DD/`.
export async function exportComedFiles(
  prisma: PrismaClient,
  decisions: readonly ComedDecision[],
  options?: { exportDir?: string; now?: Date },
): Promise<ExportComedFilesResult> {
  const dirName = options?.exportDir ?? comedFilesExportDirName(options?.now);
  const exportDir = resolve(process.cwd(), dirName);
  await mkdir(exportDir, { recursive: true });

  if (decisions.length === 0) {
    console.log(`→ Export fichiers : aucune pièce COMED, dossier ${exportDir} créé.`);
    return { exportDir, downloaded: 0, failed: 0 };
  }

  const jurisdictionShortNames = await loadJurisdictionShortNames(prisma, decisions);
  const clients = new Map<string, TelerecoursClient>();
  const getClient = (shortName: string): TelerecoursClient => {
    let client = clients.get(shortName);
    if (!client) {
      const { username, password } = telerecoursCredentials(shortName);
      client = getTelerecoursCaseFileClient({ username, password });
      clients.set(shortName, client);
    }
    return client;
  };

  let downloaded = 0;
  let failed = 0;
  const usedNamesByFolder = new Map<string, Set<string>>();

  for (let index = 0; index < decisions.length; index++) {
    const decision = decisions[index]!;
    const key = caseFileKey(decision.jurisdictionCode, decision.caseFileNumber);
    const shortName = jurisdictionShortNames.get(key) ?? decision.jurisdictionCode;
    const relativeDir = join(decision.jurisdictionCode, decision.caseFileNumber);
    const targetDir = join(exportDir, relativeDir);
    await mkdir(targetDir, { recursive: true });

    const folderKey = relativeDir;
    const usedNames = usedNamesByFolder.get(folderKey) ?? new Set<string>();
    usedNamesByFolder.set(folderKey, usedNames);

    try {
      const client = getClient(shortName);
      const { data, fileName } = await client.downloadFile(decision.encodedFileId, shortName);
      const fileNameOnDisk = resolveExportFileName(decision, fileName, usedNames);
      const targetPath = join(targetDir, fileNameOnDisk);
      await writeFile(targetPath, data);
      downloaded++;
      console.log(
        `  [${index + 1}/${decisions.length}] ${decision.jurisdictionCode} ` +
          `${decision.caseFileNumber} → ${targetPath} (${data.byteLength} octets)`,
      );
    } catch (error) {
      failed++;
      console.error(
        `  [${index + 1}/${decisions.length}] Échec ${decision.encodedFileId} ` +
          `(${decision.jurisdictionCode}/${decision.caseFileNumber}) : ${describeError(error)}`,
      );
    }

    if (index + 1 < decisions.length) {
      await sleep(DOWNLOAD_RATE_LIMIT_MS);
    }
  }

  console.log(
    `→ Export fichiers : ${downloaded} téléchargé(s), ${failed} échec(s) → ${exportDir}`,
  );
  return { exportDir, downloaded, failed };
}
