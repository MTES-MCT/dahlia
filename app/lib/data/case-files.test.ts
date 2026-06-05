import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getActorDisplayName, formatForTable, fetchCaseFilesTableData, fetchUsedStatusLabels, normalizeForSearch } from './case-files';
import { prisma } from '@/app/lib/prisma';

vi.mock('@/app/lib/prisma', () => ({
  prisma: {
    caseFile: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    status: {
      findMany: vi.fn(),
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
  // Computed columns generated in the database; not read by getActorDisplayName, but required by the Actor type.
  displayName: null,
  displayNameNormalized: null,
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
  title: null,
  creationDate: null,
  depositDate: null,
  type: null,
  estimatedHearingDate: null,
  estimatedHearingPeriod: null,
  earliestInstructionClosingDate: null,
  lastDecisionReading: null,
  directoryReference: null,
  directoryComplementaryEmails: [],
  keywords: [],
  recipientContactCount: null,
  assignedToLegalEntityDivisionId: 1,
  urgencyId: 1,
  lastStatusId: 1,
  lastStatusDate: new Date('2024-01-01'),
  lastHearingId: null,
  procedureState: null,
  chamberId: null,
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

  describe('normalizeForSearch', () => {
    it('supprime les diacritiques courants', () => {
      expect(normalizeForSearch('Café')).toBe('cafe');
      expect(normalizeForSearch('François')).toBe('francois');
      expect(normalizeForSearch('Müller')).toBe('muller');
    });

    it('met en minuscules', () => {
      expect(normalizeForSearch('DUPONT')).toBe('dupont');
    });

    it('laisse intacte une chaîne sans accents', () => {
      expect(normalizeForSearch('dupont')).toBe('dupont');
    });
  });

  describe('getActorDisplayName', () => {
    it('returns legalPersonName when available', () => {
      const result = getActorDisplayName(mockActorWithLegalPerson);
      expect(result).toBe('SARL Acme');
    });

    it('returns firstName + lastName when legalPersonName is not available', () => {
      const result = getActorDisplayName(mockActor);
      expect(result).toBe('Dupont Jean');
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
      expect(getActorDisplayName(actor)).toBe('Curie Marie');
    });
  });

  describe('formatForTable', () => {
    it('formats case files to table rows', () => {
      const result = formatForTable([mockCaseFile]);

      expect(result).toEqual([
        ['CF-2024-001', 'Dupont Jean', 'Dupont Jean', 'Très urgent', 'En cours'],
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
        rows: [['CF-2024-001', 'Dupont Jean', 'Dupont Jean', 'Très urgent', 'En cours']],
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

    it('sorts by mainClaimant relation on the computed displayName', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, 'mainClaimant', 'ascending');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { mainClaimant: { displayName: { sort: 'asc', nulls: 'last' } } },
        })
      );
    });

    it('sorts by mainDefender relation on the computed displayName descending', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, 'mainDefender', 'descending');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { mainDefender: { displayName: { sort: 'desc', nulls: 'last' } } },
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

    it('omits where when query is null', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending', null);

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: expect.anything() })
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith(undefined);
    });

    it('applies an OR filter on caseFileNumber and the normalized acteurs columns when query is provided', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending', 'Dupont');

      const expectedWhere = {
        OR: [
          { caseFileNumber: { contains: 'Dupont', mode: 'insensitive' } },
          { mainClaimant: { displayNameNormalized: { contains: 'dupont' } } },
          { mainDefender: { displayNameNormalized: { contains: 'dupont' } } },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('normalizes accents on the acteurs filter while preserving the raw query for caseFileNumber', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending', 'Frànçois');

      const expectedWhere = {
        OR: [
          { caseFileNumber: { contains: 'Frànçois', mode: 'insensitive' } },
          { mainClaimant: { displayNameNormalized: { contains: 'francois' } } },
          { mainDefender: { displayNameNormalized: { contains: 'francois' } } },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    });

    it('combines query and sort', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, 'caseFileNumber', 'ascending', 'TA069');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
          orderBy: { caseFileNumber: 'asc' },
        })
      );
    });

    it('filters by status label only when statusLabel is provided alone', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending', null, 'En cours d\'instruction');

      const expectedWhere = { lastStatus: { label: 'En cours d\'instruction' } };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('combines query and status filter with AND', async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, 'descending', 'dupont', 'Terminé');

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              expect.objectContaining({ OR: expect.any(Array) }),
              { lastStatus: { label: 'Terminé' } },
            ],
          },
        })
      );
    });
  });

  describe('fetchUsedStatusLabels', () => {
    it('returns distinct labels of statuses actually used by case files, sorted', async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([
        { label: 'En cours d\'instruction' },
        { label: 'Terminé' },
      ] as never);

      const result = await fetchUsedStatusLabels();

      expect(result).toEqual(['En cours d\'instruction', 'Terminé']);
      expect(vi.mocked(prisma.status.findMany)).toHaveBeenCalledWith({
        where: { caseFiles: { some: {} } },
        select: { label: true },
        distinct: ['label'],
        orderBy: { label: 'asc' },
      });
    });
  });
});
