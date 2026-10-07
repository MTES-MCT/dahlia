import { PrismaClient } from "@prisma/client";
import type { Hearing } from "../telerecours/types";

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Upsert a hearing session, its conclusion(s), and optionally the M2M link to a
// case file. Hearing ids are scoped by court (jurisdictionCode) and conclusion
// ids by hearing (composite PKs). Order matters: hearing row first (without
// lastConclusion), then conclusion, then set Hearing.lastConclusionId.
export async function upsertHearingWithConclusion(
  prisma: PrismaClient,
  jurisdictionCode: string,
  hearing: Hearing,
  caseFileNumber?: string,
): Promise<void> {
  const hearingKey = { jurisdictionCode, hearingId: hearing.hearingId };

  const hearingBase = {
    convocationDate: new Date(hearing.convocationDate),
    room: hearing.room,
    creationDate: parseDate(hearing.creationDate),
    modificationDates: (hearing.modificationDates ?? []).map((d) => new Date(d)),
  };

  await prisma.hearing.upsert({
    where: { jurisdictionCode_hearingId: hearingKey },
    update: hearingBase,
    create: {
      ...hearingKey,
      ...hearingBase,
      lastConclusionId: null,
    },
  });

  if (hearing.lastConclusion?.conclusionOperativePart) {
    await prisma.conclusionOperativePart.upsert({
      where: { id: hearing.lastConclusion.conclusionOperativePart.id },
      update: { label: hearing.lastConclusion.conclusionOperativePart.label },
      create: {
        id: hearing.lastConclusion.conclusionOperativePart.id,
        label: hearing.lastConclusion.conclusionOperativePart.label,
      },
    });
  }

  const lastConclusion = hearing.lastConclusion;
  if (lastConclusion?.id != null && lastConclusion.publicationDate != null) {
    const operativePartId = lastConclusion.conclusionOperativePart?.id ?? null;
    await prisma.conclusion.upsert({
      where: {
        jurisdictionCode_hearingId_id: { ...hearingKey, id: lastConclusion.id },
      },
      update: {
        conclusionSense: lastConclusion.conclusionSense,
        publicationDate: new Date(lastConclusion.publicationDate),
        author: lastConclusion.author,
        conclusionOperativePartId: operativePartId,
      },
      create: {
        ...hearingKey,
        id: lastConclusion.id,
        conclusionSense: lastConclusion.conclusionSense,
        publicationDate: new Date(lastConclusion.publicationDate),
        author: lastConclusion.author,
        conclusionOperativePartId: operativePartId,
      },
    });

    await prisma.hearing.update({
      where: { jurisdictionCode_hearingId: hearingKey },
      data: { lastConclusionId: lastConclusion.id },
    });
  }

  if (caseFileNumber) {
    await prisma.caseFileHearing.upsert({
      where: {
        jurisdictionCode_caseFileNumber_hearingId: { ...hearingKey, caseFileNumber },
      },
      update: {},
      create: { ...hearingKey, caseFileNumber },
    });
  }

  await prisma.caseFile.updateMany({
    where: { jurisdictionCode, lastHearingId: hearing.hearingId },
    data: { lastHearingConvocationDate: new Date(hearing.convocationDate) },
  });
}
