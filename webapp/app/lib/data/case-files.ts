import { Prisma } from '@prisma/client';
import { prisma } from "@/app/lib/prisma";

type CaseFileWithRelations = Prisma.CaseFileGetPayload<{
  include: {
    mainClaimant: true;
    mainDefender: true;
    urgency: true;
    lastStatus: true;
  };
}>;

export type CaseFileRow = [string, string, string, string, string];

export function getActorDisplayName(actor: CaseFileWithRelations['mainClaimant']): string {
  if (actor.legalPersonName) return actor.legalPersonName;
  if (actor.legalEntityName) return actor.legalEntityName;
  if (actor.firstName && actor.lastName) return `${actor.firstName} ${actor.lastName}`;
  if (actor.lastName) return actor.lastName;
  if (actor.firstName) return actor.firstName;
  return 'N/A';
}


async function fetchCaseFiles(page: number, numberOfCaseFiles: number, sortBy: string | null, sortOrder: string | null = null): Promise<CaseFileWithRelations[]> {
  return prisma.caseFile.findMany({
    include: {
      mainClaimant: true,
      mainDefender: true,
      urgency: true,
      lastStatus: true,
    },
    ...(sortBy ? { orderBy: { [sortBy]: sortOrder === 'ascending' ? 'asc' : 'desc' } } : {}),
    skip: (page - 1) * numberOfCaseFiles,
    take: numberOfCaseFiles,
  });
}

async function fetchCaseFilesCount(): Promise<number> {
  return prisma.caseFile.count();
}

export function formatForTable(caseFiles: CaseFileWithRelations[]): CaseFileRow[] {
  return caseFiles.map(caseFile => [
    caseFile.caseFileNumber,
    getActorDisplayName(caseFile.mainClaimant),
    getActorDisplayName(caseFile.mainDefender),
    caseFile.urgency?.description || 'N/A',
    caseFile.lastStatus.label,
  ]);
}

export type CaseFilesTableData = {
  rows: CaseFileRow[];
  totalPages: number;
  totalCount: number;
};

export async function fetchCaseFilesTableData(page: number, numberOfCaseFiles: number, sortBy: string | null, sortOrder: string): Promise<CaseFilesTableData> {
  const [caseFiles, totalCount] = await Promise.all([
    fetchCaseFiles(page, numberOfCaseFiles, sortBy, sortOrder),
    fetchCaseFilesCount(),
  ]);
  return {
    rows: formatForTable(caseFiles),
    totalPages: Math.ceil(totalCount / numberOfCaseFiles),
    totalCount: totalCount,
  };
}
