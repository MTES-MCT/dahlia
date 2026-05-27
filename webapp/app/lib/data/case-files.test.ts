import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getActorDisplayName, formatForTable, fetchCaseFilesTableData } from './case-files';
import { prisma } from '@/app/lib/prisma';

vi.mock('@/app/lib/prisma', () => ({
  prisma: {
    caseFile: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

const actorBase = {
  id: 1,
  lastFirstName: null,
  firstLastName: null,
  legalEntityId: null,
  actorType: 'NATURAL_PERSON' as const,
  qualityCode: 'particulier',
};

const mockActor = {
  ...actorBase,
  legalPersonName: null,
  legalEntityName: null,
  firstName: 'Jean',
  lastName: 'Dupont',
};

const mockActorWithLegalPerson = {
  ...actorBase,
  id: 2,
  actorType: 'LEGAL_PERSON' as const,
  legalPersonName: 'SARL Acme',
  legalEntityName: null,
  firstName: null,
  lastName: null,
};

const mockActorMinimal = {
  ...actorBase,
  id: 3,
  legalPersonName: null,
  legalEntityName: null,
  firstName: null,
  lastName: 'Martin',
};

const mockUrgency = {
  id: 1,
  key: null,
  description: 'Très urgent',
  colorHexadecimalCode: '#FF0000',
};

const mockStatus = {
  id: 1,
  label: 'En cours',
  category: 'in-progress',
  groupId: 1,
};

const mockCaseFile = {
  caseFileNumber: 'CF-2024-001',
  assignedToLegalEntityDivisionId: 1,
  urgencyId: 1,
  lastStatusId: 1,
  lastStatusDate: new Date('2024-01-01'),
  lastHearingId: null,
  procedureState: null,
  mainClaimantId: 1,
  mainDefenderId: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  mainClaimant: mockActor,
  mainDefender: mockActor,
  urgency: mockUrgency,
  lastStatus: mockStatus,
};

describe('case-files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActorDisplayName', () => {
    it('returns legalPersonName when available', () => {
      const result = getActorDisplayName(mockActorWithLegalPerson);
      expect(result).toBe('SARL Acme');
    });

    it('returns firstName + lastName when legalPersonName is not available', () => {
      const result = getActorDisplayName(mockActor);
      expect(result).toBe('Jean Dupont');
    });

    it('returns lastName when only lastName is available', () => {
      const result = getActorDisplayName(mockActorMinimal);
      expect(result).toBe('Martin');
    });

    it('returns N/A when no name is available', () => {
      const actor = { ...actorBase, id: 99, legalPersonName: null, legalEntityName: null, firstName: null, lastName: null };
      expect(getActorDisplayName(actor)).toBe('N/A');
    });

    it('returns legalEntityName when no other name is available', () => {
      const actor = { ...actorBase, id: 99, legalPersonName: null, legalEntityName: 'Company Inc', firstName: null, lastName: null };
      expect(getActorDisplayName(actor)).toBe('Company Inc');
    });

    it('returns firstName + lastName when both exist', () => {
      const actor = { ...actorBase, id: 99, legalPersonName: null, legalEntityName: null, firstName: 'Marie', lastName: 'Curie' };
      expect(getActorDisplayName(actor)).toBe('Marie Curie');
    });
  });

  describe('formatForTable', () => {
    it('formats case files to table rows', () => {
      const result = formatForTable([mockCaseFile]);

      expect(result).toEqual([
        ['CF-2024-001', 'Jean Dupont', 'Jean Dupont', 'Très urgent', 'En cours'],
      ]);
    });

    it('handles missing urgency gracefully', () => {
      const caseFile = { ...mockCaseFile, urgency: null, urgencyId: null };
      const result = formatForTable([caseFile]);

      expect(result[0][3]).toBe('N/A');
    });

    it('formats multiple case files', () => {
      const caseFile2 = { ...mockCaseFile, caseFileNumber: 'CF-2024-002', mainClaimant: mockActorWithLegalPerson, mainClaimantId: 2 };
      const result = formatForTable([mockCaseFile, caseFile2]);

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBe('CF-2024-001');
      expect(result[1][0]).toBe('CF-2024-002');
      expect(result[1][1]).toBe('SARL Acme');
    });
  });

  describe('fetchCaseFilesTableData', () => {
    it('fetches and formats case files with descending sort', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([mockCaseFile]);
      const mockCount = vi.fn().mockResolvedValue(25);

      vi.mocked(prisma.caseFile.findMany).mockImplementation(mockFindMany);
      vi.mocked(prisma.caseFile.count).mockImplementation(mockCount);

      const result = await fetchCaseFilesTableData(1, 10, 'caseFileNumber', 'descending');

      expect(result).toEqual({
        rows: [['CF-2024-001', 'Jean Dupont', 'Jean Dupont', 'Très urgent', 'En cours']],
        totalPages: 3,
        totalCount: 25,
      });
      expect(mockFindMany).toHaveBeenCalledWith({
        include: {
          mainClaimant: true,
          mainDefender: true,
          urgency: true,
          lastStatus: true,
        },
        orderBy: { caseFileNumber: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(mockCount).toHaveBeenCalled();
    });

    it('sorts ascending when sortOrder is ascending', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, 'caseFileNumber', 'ascending');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { caseFileNumber: 'asc' },
        })
      );
    });

    it('omits orderBy when sortBy is null', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({ orderBy: expect.anything() })
      );
    });

    it('handles pagination correctly on page 2', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(100);

      const result = await fetchCaseFilesTableData(2, 20, null, 'descending');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 })
      );
      expect(result.totalPages).toBe(5);
      expect(result.totalCount).toBe(100);
    });

    it('calculates correct total pages with remainder', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(35);

      const result = await fetchCaseFilesTableData(1, 10, null, 'descending');

      expect(result.totalPages).toBe(4);
      expect(result.totalCount).toBe(35);
    });

    it('handles empty results', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      const result = await fetchCaseFilesTableData(1, 10, null, 'descending');

      expect(result).toEqual({
        rows: [],
        totalPages: 0,
        totalCount: 0,
      });
    });
  });
});
