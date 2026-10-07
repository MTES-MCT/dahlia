import { PrismaClient } from "@prisma/client";
import { telerecoursApiJurisdictionCode } from "../telerecours/http";

// The Dahlia jurisdiction instance a scrape runs against: `id` tags the case
// files (permission scope), `jurisdictionCode` is the Telerecours court that
// scopes every Telerecours id (see CaseFileKey).
export interface ResolvedJurisdiction {
  id: number;
  jurisdictionCode: string;
}

// Resolve the Jurisdiction row for a Dahlia jurisdiction instance (e.g.
// "TA069bis"), creating it on first sight. `name` is left empty and edited
// manually later, so `update` is intentionally a no-op (it must not overwrite a
// name that was filled in by hand).
// `jurisdictionCode` comes from the environment (see
// telerecoursApiJurisdictionCode) and is only written on create: every
// court-scoped row already carries it, so a later change of
// `<shortName>_TELERECOURS_JURISDICTION` would silently mix two courts. Refuse
// to run in that case.
export async function upsertJurisdiction(
  prisma: PrismaClient,
  shortName: string,
): Promise<ResolvedJurisdiction> {
  const jurisdictionCode = telerecoursApiJurisdictionCode(shortName);
  const jurisdiction = await prisma.jurisdiction.upsert({
    where: { shortName },
    update: {},
    create: { shortName, jurisdictionCode },
  });
  if (jurisdiction.jurisdictionCode !== jurisdictionCode) {
    throw new Error(
      `Jurisdiction ${shortName}: court code "${jurisdiction.jurisdictionCode}" in database ` +
        `but "${jurisdictionCode}" from the environment ` +
        `(${shortName}_TELERECOURS_JURISDICTION). Fix the environment or migrate the data.`,
    );
  }
  return { id: jurisdiction.id, jurisdictionCode };
}
