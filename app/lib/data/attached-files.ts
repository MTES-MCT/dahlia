import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

// Fetch a single attached file (pièce) with its file-family label and the
// minimal case-file info needed for the breadcrumb. Returns null when unknown.
export async function fetchAttachedFile(encodedFileId: string) {
  return prisma.attachedFile.findUnique({
    where: { encodedFileId },
    include: {
      fileFamilyType: true,
      caseFile: { select: { caseFileNumber: true, title: true } },
    },
  });
}

export type AttachedFileDetail = Prisma.PromiseReturnType<typeof fetchAttachedFile>;

// Fetch every pièce of a case file with the fields needed to rebuild the table's
// ordered/filtered list on the pièce edition page (navigator). Sorting/filtering
// is reapplied client-side via the shared `pieces-table` query columns.
export async function fetchCaseFilePieces(caseFileNumber: string) {
  return prisma.attachedFile.findMany({
    where: { caseFileNumber },
    select: {
      encodedFileId: true,
      originalFileName: true,
      dahliaName: true,
      fileTypeLabel: true,
      eventCreationDate: true,
      mimeType: true,
    },
  });
}

export type CaseFilePiece = Prisma.PromiseReturnType<typeof fetchCaseFilePieces>[number];
