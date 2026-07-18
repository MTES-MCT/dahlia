import { describe, it, expect, beforeEach, vi } from "vitest";
import { getActorDisplayName } from "@/app/lib/case-file-format";
import { CASE_FILES_DASHBOARD_INCLUDE, HEARING_CONVOCATION_SORT_KEY } from "@/app/lib/case-files-dashboard-columns";
import { fetchCaseFilesTableData } from "./case-files";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
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
  actorType: "NATURAL_PERSON" as const,
  displayName: null,
  displayNameNormalized: null,
};

const mockActor = {
  ...actorBase,
  legalPersonName: null,
  legalEntityName: null,
  firstName: "Jean",
  lastName: "Dupont",
};

const mockCaseFileActors = [
  {
    caseFileNumber: "CF-2024-001",
    actorId: 1,
    qualityCode: "R",
    isMainClaimant: true,
    isMainDefender: false,
    actor: mockActor,
    quality: { code: "R", name: "Requérant" },
  },
  {
    caseFileNumber: "CF-2024-001",
    actorId: 1,
    qualityCode: "D",
    isMainClaimant: false,
    isMainDefender: true,
    actor: mockActor,
    quality: { code: "D", name: "Défendeur" },
  },
];

const mockActorWithLegalPerson = {
  ...actorBase,
  id: 2,
  actorType: "LEGAL_PERSON" as const,
  legalPersonName: "SARL Acme",
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
  lastName: "Martin",
};

const mockUrgency = {
  id: 1,
  key: null,
  description: "Très urgent",
  colorHexadecimalCode: "#FF0000",
};

const mockStatus = {
  id: 1,
  label: "En cours",
  category: "in-progress",
  groupId: 1,
  // Computed column generated in the database (lower(f_unaccent(label))).
  labelNormalized: null,
};

const mockCaseFile = {
  caseFileNumber: "CF-2024-001",
  title: null,
  creationDate: null,
  depositDate: null,
  type: null,
  estimatedHearingDate: null,
  estimatedHearingPeriod: null,
  earliestInstructionClosingDate: null,
  directoryReference: null,
  directoryComplementaryEmails: null,
  keywords: [],
  recipientContactCount: null,
  assignedToLegalEntityDivisionId: 1,
  urgencyId: 1,
  lastStatusId: 1,
  lastStatusDate: new Date("2024-01-01"),
  lastHearingId: null,
  procedureState: null,
  chamberId: null,
  lastProducerId: 1,
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  caseFileActors: mockCaseFileActors,
  lastProducer: mockActor,
  urgency: mockUrgency,
  lastStatus: mockStatus,
  lastHearing: null,
};

describe("case-files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActorDisplayName", () => {
    it("returns legalPersonName when available", () => {
      const result = getActorDisplayName(mockActorWithLegalPerson);
      expect(result).toBe("SARL Acme");
    });

    it("returns firstName + lastName when legalPersonName is not available", () => {
      const result = getActorDisplayName(mockActor);
      expect(result).toBe("Dupont Jean");
    });

    it("returns lastName when only lastName is available", () => {
      const result = getActorDisplayName(mockActorMinimal);
      expect(result).toBe("Martin");
    });

    it("returns '-' when no name is available", () => {
      const actor = {
        ...actorBase,
        id: 99,
        legalPersonName: null,
        legalEntityName: null,
        firstName: null,
        lastName: null,
      };
      expect(getActorDisplayName(actor)).toBe("-");
    });

    it("returns legalEntityName when no other name is available", () => {
      const actor = {
        ...actorBase,
        id: 99,
        legalPersonName: null,
        legalEntityName: "Company Inc",
        firstName: null,
        lastName: null,
      };
      expect(getActorDisplayName(actor)).toBe("Company Inc");
    });

    it("returns firstName + lastName when both exist", () => {
      const actor = {
        ...actorBase,
        id: 99,
        legalPersonName: null,
        legalEntityName: null,
        firstName: "Marie",
        lastName: "Curie",
      };
      expect(getActorDisplayName(actor)).toBe("Curie Marie");
    });

    it("returns firstName + lastName for a natural person even when legalEntityName is set", () => {
      const actor = {
        ...actorBase,
        id: 99,
        legalPersonName: null,
        legalEntityName: "CADOUX",
        firstName: "Eloise",
        lastName: "CADOUX",
      };
      expect(getActorDisplayName(actor)).toBe("CADOUX Eloise");
    });
  });

  describe("fetchCaseFilesTableData", () => {
    it("fetches case files with descending sort", async () => {
      const mockFindMany = vi.fn().mockResolvedValue([mockCaseFile]);
      const mockCount = vi.fn().mockResolvedValue(25);

      vi.mocked(prisma.caseFile.findMany).mockImplementation(mockFindMany);
      vi.mocked(prisma.caseFile.count).mockImplementation(mockCount);

      const result = await fetchCaseFilesTableData(1, 10, "caseFileNumber", "descending");

      expect(result).toEqual({
        rows: [mockCaseFile],
        totalPages: 3,
        totalCount: 25,
      });
      expect(mockFindMany).toHaveBeenCalledWith({
        include: CASE_FILES_DASHBOARD_INCLUDE,
        where: { isDeleted: false },
        orderBy: { caseFileNumber: "desc" },
        skip: 0,
        take: 10,
      });
      expect(mockCount).toHaveBeenCalled();
    });

    it("sorts ascending when sortOrder is ascending", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "caseFileNumber", "ascending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { caseFileNumber: "asc" },
        }),
      );
    });

    it("ignores sortBy on mainClaimant (column is filter-only)", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "mainClaimant", "ascending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({ orderBy: expect.anything() }),
      );
    });

    it("ignores sortBy on mainDefender (column is filter-only)", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "mainDefender", "descending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({ orderBy: expect.anything() }),
      );
    });

    it("sorts by the generated memoryDeadlineDate column", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, HEARING_CONVOCATION_SORT_KEY, "ascending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { memoryDeadlineDate: { sort: "asc", nulls: "last" } },
        }),
      );
    });

    it("omits orderBy when sortBy is null", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({ orderBy: expect.anything() }),
      );
    });

    it("handles pagination correctly on page 2", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(100);

      const result = await fetchCaseFilesTableData(2, 20, null, "descending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.totalPages).toBe(5);
      expect(result.totalCount).toBe(100);
    });

    it("calculates correct total pages with remainder", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(35);

      const result = await fetchCaseFilesTableData(1, 10, null, "descending");

      expect(result.totalPages).toBe(4);
      expect(result.totalCount).toBe(35);
    });

    it("handles empty results", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      const result = await fetchCaseFilesTableData(1, 10, null, "descending");

      expect(result).toEqual({
        rows: [],
        totalPages: 0,
        totalCount: 0,
      });
    });

    it("only filters out deleted case files when no query/status is provided", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", null);

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isDeleted: false } }),
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({
        where: { isDeleted: false },
      });
    });

    it("applies an OR filter on caseFileNumber and the normalized acteurs columns when query is provided", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "Dupont");

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            OR: [
              { caseFileNumber: { contains: "Dupont", mode: "insensitive" } },
              {
                caseFileActors: {
                  some: {
                    isMainClaimant: true,
                    actor: { displayNameNormalized: { contains: "dupont" } },
                  },
                },
              },
              {
                caseFileActors: {
                  some: {
                    isMainDefender: true,
                    actor: { displayNameNormalized: { contains: "dupont" } },
                  },
                },
              },
              { lastProducer: { displayNameNormalized: { contains: "dupont" } } },
            ],
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it("normalizes accents on the acteurs filter while preserving the raw query for caseFileNumber", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "Frànçois");

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            OR: [
              { caseFileNumber: { contains: "Frànçois", mode: "insensitive" } },
              {
                caseFileActors: {
                  some: {
                    isMainClaimant: true,
                    actor: { displayNameNormalized: { contains: "francois" } },
                  },
                },
              },
              {
                caseFileActors: {
                  some: {
                    isMainDefender: true,
                    actor: { displayNameNormalized: { contains: "francois" } },
                  },
                },
              },
              { lastProducer: { displayNameNormalized: { contains: "francois" } } },
            ],
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("combines query and sort", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "caseFileNumber", "ascending", "TA069");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ isDeleted: false }, expect.objectContaining({ OR: expect.any(Array) })],
          },
          orderBy: { caseFileNumber: "asc" },
        }),
      );
    });

    it("restricts the search to the requerant column for a requerant: facet", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "requerant:Préfet");

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            caseFileActors: {
              some: {
                isMainClaimant: true,
                actor: { displayNameNormalized: { contains: "prefet" } },
              },
            },
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it("combines several facets with AND, each scoped to its column", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "requerant:prefet defendeur:dupont");

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            caseFileActors: {
              some: {
                isMainClaimant: true,
                actor: { displayNameNormalized: { contains: "prefet" } },
              },
            },
          },
          {
            caseFileActors: {
              some: {
                isMainDefender: true,
                actor: { displayNameNormalized: { contains: "dupont" } },
              },
            },
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("filters the dossier column case-insensitively for a dossier: facet", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "dossier:TA069");

      const expectedWhere = {
        AND: [{ isDeleted: false }, { caseFileNumber: { contains: "TA069", mode: "insensitive" } }],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("filters the statut column accent-insensitively for a statut: facet", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "statut:role");

      const expectedWhere = {
        AND: [{ isDeleted: false }, { lastStatus: { labelNormalized: { contains: "role" } } }],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("combines free text (global OR) with a facet", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "dupont requerant:prefet");

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            OR: [
              { caseFileNumber: { contains: "dupont", mode: "insensitive" } },
              {
                caseFileActors: {
                  some: {
                    isMainClaimant: true,
                    actor: { displayNameNormalized: { contains: "dupont" } },
                  },
                },
              },
              {
                caseFileActors: {
                  some: {
                    isMainDefender: true,
                    actor: { displayNameNormalized: { contains: "dupont" } },
                  },
                },
              },
              { lastProducer: { displayNameNormalized: { contains: "dupont" } } },
            ],
          },
          {
            caseFileActors: {
              some: {
                isMainClaimant: true,
                actor: { displayNameNormalized: { contains: "prefet" } },
              },
            },
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("matches every word of a multi-word requerant facet regardless of order", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", 'requerant:"Dupont Jean"');

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            AND: [
              {
                caseFileActors: {
                  some: {
                    isMainClaimant: true,
                    actor: { displayNameNormalized: { contains: "dupont" } },
                  },
                },
              },
              {
                caseFileActors: {
                  some: {
                    isMainClaimant: true,
                    actor: { displayNameNormalized: { contains: "jean" } },
                  },
                },
              },
            ],
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("matches every word of a multi-word statut facet regardless of order", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", 'statut:"Inscrit role audience"');

      const expectedWhere = {
        AND: [
          { isDeleted: false },
          {
            AND: [
              { lastStatus: { labelNormalized: { contains: "inscrit" } } },
              { lastStatus: { labelNormalized: { contains: "role" } } },
              { lastStatus: { labelNormalized: { contains: "audience" } } },
            ],
          },
        ],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("filters by status label only when statusLabel is provided alone", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", null, "En cours d'instruction");

      const expectedWhere = {
        AND: [{ isDeleted: false }, { lastStatus: { label: "En cours d'instruction" } }],
      };

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(vi.mocked(prisma.caseFile.count)).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it("combines query and status filter with AND", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, null, "descending", "dupont", "Terminé");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { isDeleted: false },
              expect.objectContaining({ OR: expect.any(Array) }),
              { lastStatus: { label: "Terminé" } },
            ],
          },
        }),
      );
    });
  });
});
