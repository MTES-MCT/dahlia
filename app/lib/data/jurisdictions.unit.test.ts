import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchJurisdictionOptions, fetchJurisdictionsTableData } from "./jurisdictions";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    jurisdiction: {
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

const mockJurisdictions = [
  { id: 1, name: "Tribunal administratif de Lyon", shortName: "TA069" },
  { id: 2, name: "Tribunal administratif de Paris", shortName: "TA075" },
];

describe("fetchJurisdictionsTableData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.jurisdiction.findMany).mockResolvedValue(mockJurisdictions as never);
    vi.mocked(prisma.jurisdiction.count).mockResolvedValue(2);
  });

  it("retourne les juridictions paginées avec le tri par défaut (code asc)", async () => {
    const result = await fetchJurisdictionsTableData({});

    expect(result.rows).toEqual(mockJurisdictions);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(30);

    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { shortName: "asc" },
        skip: 0,
        take: 30,
      }),
    );
  });

  it("applique la recherche texte libre sur code et nom", async () => {
    await fetchJurisdictionsTableData({ dahliaq: "lyon" });

    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { shortName: { contains: "lyon", mode: "insensitive" } },
            { name: { contains: "lyon", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applique les filtres à facette code / nom", async () => {
    await fetchJurisdictionsTableData({ dahliaq: "code:TA069 nom:Lyon" });

    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { shortName: { contains: "TA069", mode: "insensitive" } },
            { name: { contains: "Lyon", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("trie par nom décroissant quand demandé", async () => {
    await fetchJurisdictionsTableData({ sortBy: "name", sortOrder: "descending" });

    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "desc" },
      }),
    );
  });
});

describe("fetchJurisdictionOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.jurisdiction.findMany).mockResolvedValue(mockJurisdictions as never);
  });

  it("retourne toutes les juridictions triées par code, sans pagination", async () => {
    const result = await fetchJurisdictionOptions();

    expect(result).toEqual(mockJurisdictions);
    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, shortName: true },
      orderBy: { shortName: "asc" },
    });
  });
});
