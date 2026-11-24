import type { Prisma } from "@prisma/client";

// `--jurisdiction <shortName>` of every data/ CLI names a Dahlia jurisdiction
// instance (Jurisdiction.shortName: TA069, TA069bis…), never a court code.
// From the instance follow:
//   - the Telerecours credentials: <shortName>_TELERECOURS_USERNAME / _PASSWORD
//     (see telerecoursCredentials);
//   - the Telerecours court: <shortName>_TELERECOURS_JURISDICTION, else the
//     shortName itself (see telerecoursApiJurisdictionCode). It is the
//     X-Jurisdiction-Code header and the `jurisdictionCode` column of every
//     court-scoped row: TA069 for both TA069 and TA069bis;
//   - the database perimeter: case files whose jurisdiction has this shortName
//     (see jurisdictionInstanceWhere). Comparing `jurisdictionCode` with the
//     shortName would match nothing for TA069bis.
// Case files still at jurisdictionId null (imported before the Jurisdiction
// model) stay out of an instance's perimeter until a scrape tags them.

export function jurisdictionInstanceWhere(shortName: string) {
  return { jurisdiction: { shortName } } satisfies Prisma.CaseFileWhereInput;
}

export function telerecoursCredentials(shortName: string): { username: string; password: string } {
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
