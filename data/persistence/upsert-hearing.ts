import { PrismaClient } from "@prisma/client";
import type { Hearing } from "../telerecours/types";

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Upsert a hearing session, its conclusion(s), and optionally the M2M link to a
// case file. Conclusion ids are scoped by hearingId (composite PK). Order
// matters: hearing row first (without lastConclusion), then conclusion, then
// set Hearing.lastConclusionId.
export async function upsertHearingWithConclusion(
  prisma: PrismaClient,
  hearing: Hearing,
  caseFileNumber?: string,
): Promise<void> {
  const hearingBase = {
    convocationDate: new Date(hearing.convocationDate),
    room: hearing.room,
    creationDate: parseDate(hearing.creationDate),
    modificationDates: (hearing.modificationDates ?? []).map((d) => new Date(d)),
  };

  await prisma.hearing.upsert({
    where: { hearingId: hearing.hearingId },
    update: hearingBase,
    create: {
      hearingId: hearing.hearingId,
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
        id_hearingId: { id: lastConclusion.id, hearingId: hearing.hearingId },
      },
      update: {
        conclusionSense: lastConclusion.conclusionSense,
        publicationDate: new Date(lastConclusion.publicationDate),
        author: lastConclusion.author,
        conclusionOperativePartId: operativePartId,
      },
      create: {
        id: lastConclusion.id,
        hearingId: hearing.hearingId,
        conclusionSense: lastConclusion.conclusionSense,
        publicationDate: new Date(lastConclusion.publicationDate),
        author: lastConclusion.author,
        conclusionOperativePartId: operativePartId,
      },
    });

    await prisma.hearing.update({
      where: { hearingId: hearing.hearingId },
      data: { lastConclusionId: lastConclusion.id },
    });
  }

  if (caseFileNumber) {
    await prisma.caseFileHearing.upsert({
      where: {
        caseFileNumber_hearingId: { caseFileNumber, hearingId: hearing.hearingId },
      },
      update: {},
      create: { caseFileNumber, hearingId: hearing.hearingId },
    });
  }

  await prisma.caseFile.updateMany({
    where: { lastHearingId: hearing.hearingId },
    data: { lastHearingConvocationDate: new Date(hearing.convocationDate) },
  });
}
