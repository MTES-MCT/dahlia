import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { buildTagsWhere, fetchTagCaseFiles, fetchTagOptions, fetchTagsTableData } from "./tags";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    caseFile: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/app/lib/fetch-paginated-table-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/fetch-paginated-table-data")>();
  return {
    ...actual,
    resolveTablePageSize: vi.fn(async () => 30 as const),
  };
});

// Permission scope: empty fragment (administrator) unless a test says otherwise.
const mockCaseFileScopeWhere = vi.fn(async () => ({}) as Prisma.CaseFileWhereInput);

vi.mock("@/app/lib/case-file-scope", () => ({
  caseFileScopeWhere: () => mockCaseFileScopeWhere(),
}));

const mockTagRows = [
  { id: 1, label: "Urgent", color: "pink-tuile", _count: { caseFileTags: 3 } },
  { id: 2, label: "À relancer", color: "green-menthe", _count: { caseFileTags: 0 } },
];

describe("data/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseFileScopeWhere.mockResolvedValue({});
    vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTagRows as never);
    vi.mocked(prisma.tag.count).mockResolvedValue(2);
  });

  describe("buildTagsWhere", () => {
    it("ne filtre rien sans requête", () => {
      expect(buildTagsWhere(null)).toEqual({});
      expect(buildTagsWhere("")).toEqual({});
    });

    it("cherche le texte libre dans le libellé", () => {
      expect(buildTagsWhere("urgent")).toEqual({
        label: { contains: "urgent", mode: "insensitive" },
      });
    });

    it("applique la facette nom:", () => {
      expect(buildTagsWhere("nom:urgent")).toEqual({
        label: { contains: "urgent", mode: "insensitive" },
      });
    });

    it("combine chaque mot du texte libre en ET", () => {
      expect(buildTagsWhere("à relancer")).toEqual({
        AND: [
          { label: { contains: "à", mode: "insensitive" } },
          { label: { contains: "relancer", mode: "insensitive" } },
        ],
      });
    });
  });

  describe("fetchTagsTableData", () => {
    it("pagine avec le tri par défaut (libellé ascendant)", async () => {
      const result = await fetchTagsTableData({});

      expect(result.totalCount).toBe(2);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(30);
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { label: "asc" },
          skip: 0,
          take: 30,
        }),
      );
    });

    it("expose le nombre de dossiers portant chaque tag", async () => {
      const result = await fetchTagsTableData({});

      expect(result.rows).toEqual([
        { id: 1, label: "Urgent", color: "pink-tuile", caseFileCount: 3 },
        { id: 2, label: "À relancer", color: "green-menthe", caseFileCount: 0 },
      ]);
    });

    it("trie sur le nombre de dossiers via le compte de la relation", async () => {
      await fetchTagsTableData({ sortBy: "caseFileCount", sortOrder: "descending" });

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { caseFileTags: { _count: "desc" } } }),
      );
    });
  });

  describe("fetchTagOptions", () => {
    it("trie les libellés selon l'ordre alphabétique français", async () => {
      vi.mocked(prisma.tag.findMany).mockResolvedValue([
        { id: 1, label: "Urgent", color: "pink-tuile" },
        { id: 3, label: "Étranger", color: "blue-cumulus" },
        { id: 2, label: "À relancer", color: "green-menthe" },
      ] as never);

      const options = await fetchTagOptions();

      expect(options.map((tag) => tag.label)).toEqual(["À relancer", "Étranger", "Urgent"]);
    });
  });

  describe("fetchTagCaseFiles", () => {
    beforeEach(() => {
      vi.mocked(prisma.caseFile.findMany).mockResolvedValue([] as never);
    });

    it("restreint la recherche au périmètre de droit", async () => {
      mockCaseFileScopeWhere.mockResolvedValue({ jurisdictionId: { in: [7] } });

      await fetchTagCaseFiles(1);

      expect(prisma.caseFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isDeleted: false,
            caseFileTags: { some: { tagId: 1 } },
            jurisdictionId: { in: [7] },
          },
        }),
      );
    });

    it("borne le nombre de dossiers remontés", async () => {
      await fetchTagCaseFiles(1, 10);

      expect(prisma.caseFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });
  });
});
