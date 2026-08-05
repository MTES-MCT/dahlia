import { PrismaClient } from "@prisma/client";

// Resolve the Jurisdiction row for a Telerecours jurisdiction code (e.g.
// "TA069"), creating it on first sight. Only `shortName` is set: `name` is left
// empty and edited manually later, so `update` is intentionally a no-op (it
// must not overwrite a name that was filled in by hand).
export async function upsertJurisdiction(prisma: PrismaClient, shortName: string): Promise<number> {
  const jurisdiction = await prisma.jurisdiction.upsert({
    where: { shortName },
    update: {},
    create: { shortName },
  });
  return jurisdiction.id;
}
