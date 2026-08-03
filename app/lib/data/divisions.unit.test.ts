import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchDivisionsTableData } from "./divisions";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    legalEntityDivision: {
      findMany: vi.fn(),
      count: vi.fn(),
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

const mockDivisions = [
  { id: 2488, name: "1ère chambre", shortName: "1CH" },
  { id: 2490, name: "2ème chambre", shortName: "2CH" },
];

describe("fetchDivisionsTableData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.legalEntityDivision.findMany).mockResolvedValue(mockDivisions as never);
    vi.mocked(prisma.legalEntityDivision.count).mockResolvedValue(2);
  });

  it("retourne les divisions paginées avec le tri par défaut (code asc)", async () => {
    const result = await fetchDivisionsTableData({});

    expect(result.rows).toEqual(mockDivisions);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(30);

    expect(prisma.legalEntityDivision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { shortName: "asc" },
        skip: 0,
        take: 30,
      }),
    );
  });

  it("applique la recherche texte libre sur code et nom", async () => {
    await fetchDivisionsTableData({ dahliaq: "chambre" });

    expect(prisma.legalEntityDivision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { shortName: { contains: "chambre", mode: "insensitive" } },
            { name: { contains: "chambre", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applique les filtres à facette code / nom", async () => {
    await fetchDivisionsTableData({ dahliaq: "code:1CH nom:chambre" });

    expect(prisma.legalEntityDivision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { shortName: { contains: "1CH", mode: "insensitive" } },
            { name: { contains: "chambre", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("trie par nom décroissant quand demandé", async () => {
    await fetchDivisionsTableData({ sortBy: "name", sortOrder: "descending" });

    expect(prisma.legalEntityDivision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "desc" },
      }),
    );
  });
});
