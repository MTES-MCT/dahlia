import "server-only";
import { caseFileUniqueWhere, type CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";
import { getTelerecoursCaseFileClient } from "@/data/telerecours/client";

// Build (or reuse) the Télérecours client for a jurisdiction, reading the
// matching credentials from the environment. Throws a readable error when the
// credentials are missing so callers can surface it to the user.
export function getTelerecoursClient(jurisdiction: string) {
  const username = process.env[`${jurisdiction}_TELERECOURS_USERNAME`];
  const password = process.env[`${jurisdiction}_TELERECOURS_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Identifiants Télérecours manquants pour ${jurisdiction} ` +
        `(${jurisdiction}_TELERECOURS_USERNAME / _PASSWORD).`,
    );
  }
  return { client: getTelerecoursCaseFileClient({ username, password }), jurisdiction };
}

// Resolve the case file's Dahlia jurisdiction instance (e.g. "TA034",
// "TA069bis") then build the matching client. Used by UI entry points (refresh,
// pièce download) so each dossier talks to Télérecours with its own credentials.
export async function getTelerecoursClientForCaseFile(key: CaseFileKey) {
  const caseFile = await prisma.caseFile.findUnique({
    where: caseFileUniqueWhere(key),
    select: { jurisdiction: { select: { shortName: true } } },
  });
  const jurisdiction = caseFile?.jurisdiction?.shortName;
  if (!jurisdiction) {
    throw new Error(
      `Juridiction inconnue pour le dossier ${key.caseFileNumber} (${key.jurisdictionCode}). ` +
        `Impossible d'appeler Télérecours.`,
    );
  }
  return getTelerecoursClient(jurisdiction);
}
