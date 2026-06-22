import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getActorDisplayName,
  formatForTable,
  fetchCaseFilesTableData,
  fetchUsedStatusLabels,
  normalizeForSearch,
  parseSearchQuery,
} from "./case-files";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
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
  actorType: "NATURAL_PERSON" as const,
  qualityCode: "particulier",
  // Computed columns generated in the database; not read by getActorDisplayName, but required by the Actor type.
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
  lastDecisionReading: null,
  directoryReference: null,
  directoryComplementaryEmails: [],
  keywords: [],
  recipientContactCount: null,
  assignedToLegalEntityDivisionId: 1,
  urgencyId: 1,
  lastStatusId: 1,
  lastStatusDate: new Date("2024-01-01"),
  lastHearingId: null,
  procedureState: null,
  chamberId: null,
  mainClaimantId: 1,
  mainDefenderId: 1,
  lastProducerId: 1,
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  mainClaimant: mockActor,
  mainDefender: mockActor,
  lastProducer: mockActor,
  urgency: mockUrgency,
  lastStatus: mockStatus,
  lastHearing: null,
};

const mockHearing = {
  hearingId: "98577",
  convocationDate: new Date("2026-07-01T13:00:00.000Z"),
  room: "n° 5",
  creationDate: null,
  modificationDates: [],
  lastConclusionId: null,
  caseFileNumber: "CF-2024-001",
};

describe("case-files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeForSearch", () => {
    it("supprime les diacritiques courants", () => {
      expect(normalizeForSearch("Café")).toBe("cafe");
      expect(normalizeForSearch("François")).toBe("francois");
      expect(normalizeForSearch("Müller")).toBe("muller");
    });

    it("met en minuscules", () => {
      expect(normalizeForSearch("DUPONT")).toBe("dupont");
    });

    it("laisse intacte une chaîne sans accents", () => {
      expect(normalizeForSearch("dupont")).toBe("dupont");
    });
  });

  describe("parseSearchQuery", () => {
    it("treats a plain query as free text without facets", () => {
      expect(parseSearchQuery("dupont")).toEqual({ freeText: "dupont", facets: [] });
    });

    it("extracts a single facet and restricts to its column", () => {
      expect(parseSearchQuery("requerant:prefet")).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "prefet" }],
      });
    });

    it("normalizes the facet key (case- and accent-insensitive)", () => {
      expect(parseSearchQuery("Requérant:prefet")).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "prefet" }],
      });
    });

    it("supports several facets combined together", () => {
      expect(parseSearchQuery("requerant:prefet defendeur:dupont")).toEqual({
        freeText: null,
        facets: [
          { key: "requerant", value: "prefet" },
          { key: "defendeur", value: "dupont" },
        ],
      });
    });

    it("keeps free text alongside facets", () => {
      expect(parseSearchQuery("prefet statut:cours")).toEqual({
        freeText: "prefet",
        facets: [{ key: "statut", value: "cours" }],
      });
    });

    it("keeps an unknown key as free text", () => {
      expect(parseSearchQuery("foo:bar")).toEqual({ freeText: "foo:bar", facets: [] });
    });

    it("keeps a key with an empty value as free text", () => {
      expect(parseSearchQuery("requerant:")).toEqual({ freeText: "requerant:", facets: [] });
    });

    it("treats a double-quoted segment as a single free-text token", () => {
      expect(parseSearchQuery('"jean dupont"')).toEqual({
        freeText: "jean dupont",
        facets: [],
      });
    });

    it("keeps quoted free text alongside unquoted tokens and facets", () => {
      expect(parseSearchQuery('prefet "jean dupont" statut:cours')).toEqual({
        freeText: "prefet jean dupont",
        facets: [{ key: "statut", value: "cours" }],
      });
    });

    it("supports quoted facet values containing spaces", () => {
      expect(parseSearchQuery('requerant:"jean dupont"')).toEqual({
        freeText: null,
        facets: [{ key: "requerant", value: "jean dupont" }],
      });
    });

    it("treats a quoted key:value pair as literal free text", () => {
      expect(parseSearchQuery('"requerant:prefet"')).toEqual({
        freeText: "requerant:prefet",
        facets: [],
      });
    });
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

    it("returns N/A when no name is available", () => {
      const actor = {
        ...actorBase,
        id: 99,
        legalPersonName: null,
        legalEntityName: null,
        firstName: null,
        lastName: null,
      };
      expect(getActorDisplayName(actor)).toBe("N/A");
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
  });

  describe("formatForTable", () => {
    it("formats case files to table rows", () => {
      const result = formatForTable([mockCaseFile]);

      expect(result).toEqual([
        ["CF-2024-001", "", "Dupont Jean", "Dupont Jean", "Dupont Jean", "En cours", null],
      ]);
    });

    it("exposes the raw lastHearing convocationDate as the last column", () => {
      const caseFile = { ...mockCaseFile, lastHearing: mockHearing };
      const result = formatForTable([caseFile]);

      expect(result[0][6]).toEqual(mockHearing.convocationDate);
    });

    it("exposes a null memory deadline when lastHearing is absent", () => {
      const result = formatForTable([mockCaseFile]);

      expect(result[0][6]).toBeNull();
    });

    it("formats depositDate as dd/mm/yyyy", () => {
      const caseFile = { ...mockCaseFile, depositDate: new Date("2024-03-09") };
      const result = formatForTable([caseFile]);

      expect(result[0][1]).toBe("09/03/2024");
    });

    it("renders an empty depositDate as an empty string", () => {
      const result = formatForTable([mockCaseFile]);

      expect(result[0][1]).toBe("");
    });

    it("formats multiple case files", () => {
      const caseFile2 = {
        ...mockCaseFile,
        caseFileNumber: "CF-2024-002",
        mainClaimant: mockActorWithLegalPerson,
        mainClaimantId: 2,
      };
      const result = formatForTable([mockCaseFile, caseFile2]);

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBe("CF-2024-001");
      expect(result[1][0]).toBe("CF-2024-002");
      expect(result[1][2]).toBe("SARL Acme");
    });
  });

  describe("fetchCaseFilesTableData", () => {
    it("fetches and formats case files with descending sort", async () => {
      const mockFindMany = vi.fn().mockResolvedValue([mockCaseFile]);
      const mockCount = vi.fn().mockResolvedValue(25);

      vi.mocked(prisma.caseFile.findMany).mockImplementation(mockFindMany);
      vi.mocked(prisma.caseFile.count).mockImplementation(mockCount);

      const result = await fetchCaseFilesTableData(1, 10, "caseFileNumber", "descending");

      expect(result).toEqual({
        rows: [["CF-2024-001", "", "Dupont Jean", "Dupont Jean", "Dupont Jean", "En cours", null]],
        totalPages: 3,
        totalCount: 25,
      });
      expect(mockFindMany).toHaveBeenCalledWith({
        include: {
          mainClaimant: true,
          mainDefender: true,
          lastProducer: true,
          urgency: true,
          lastStatus: true,
          lastHearing: true,
        },
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

    it("sorts by mainClaimant relation on the computed displayName", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "mainClaimant", "ascending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { mainClaimant: { displayName: { sort: "asc", nulls: "last" } } },
        }),
      );
    });

    it("sorts by mainDefender relation on the computed displayName descending", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "mainDefender", "descending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { mainDefender: { displayName: { sort: "desc", nulls: "last" } } },
        }),
      );
    });

    it("sorts by the lastHearing convocationDate through the relation", async () => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.caseFile.count).mockResolvedValue(0);

      await fetchCaseFilesTableData(1, 10, "convocationDate", "ascending");

      expect(vi.mocked(prisma.caseFile.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastHearing: { convocationDate: "asc" } },
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
              { mainClaimant: { displayNameNormalized: { contains: "dupont" } } },
              { mainDefender: { displayNameNormalized: { contains: "dupont" } } },
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
              { mainClaimant: { displayNameNormalized: { contains: "francois" } } },
              { mainDefender: { displayNameNormalized: { contains: "francois" } } },
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
          { mainClaimant: { displayNameNormalized: { contains: "prefet" } } },
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
          { mainClaimant: { displayNameNormalized: { contains: "prefet" } } },
          { mainDefender: { displayNameNormalized: { contains: "dupont" } } },
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
              { mainClaimant: { displayNameNormalized: { contains: "dupont" } } },
              { mainDefender: { displayNameNormalized: { contains: "dupont" } } },
              { lastProducer: { displayNameNormalized: { contains: "dupont" } } },
            ],
          },
          { mainClaimant: { displayNameNormalized: { contains: "prefet" } } },
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
              { mainClaimant: { displayNameNormalized: { contains: "dupont" } } },
              { mainClaimant: { displayNameNormalized: { contains: "jean" } } },
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

  describe("fetchUsedStatusLabels", () => {
    it("returns distinct labels of statuses actually used by case files, sorted", async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([
        { label: "En cours d'instruction" },
        { label: "Terminé" },
      ] as never);

      const result = await fetchUsedStatusLabels();

      expect(result).toEqual(["En cours d'instruction", "Terminé"]);
      expect(vi.mocked(prisma.status.findMany)).toHaveBeenCalledWith({
        where: { caseFiles: { some: { isDeleted: false } } },
        select: { label: true },
        distinct: ["label"],
        orderBy: { label: "asc" },
      });
    });
  });
});
