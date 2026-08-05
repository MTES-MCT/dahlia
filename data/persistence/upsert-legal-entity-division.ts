import { PrismaClient } from "@prisma/client";

type LegalEntityDivisionInput = {
  id: number;
  name: string;
  shortName: string;
};

// Upsert a LegalEntityDivision from a Télérecours payload. On create, both
// `name` and `shortName` are stored. On update, only `shortName` is synced:
// `name` may have been edited in the admin UI and must not be overwritten.
export async function upsertLegalEntityDivision(
  prisma: PrismaClient,
  division: LegalEntityDivisionInput,
): Promise<void> {
  await prisma.legalEntityDivision.upsert({
    where: { id: division.id },
    update: {
      shortName: division.shortName,
    },
    create: {
      id: division.id,
      name: division.name,
      shortName: division.shortName,
    },
  });
}
