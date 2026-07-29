import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchUsersTableData } from "./users";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
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

const mockUsers = [
  {
    id: "u1",
    firstName: "Alice",
    lastName: "Martin",
    email: "alice.martin@example.gouv.fr",
    isValidated: true,
    isAdmin: false,
    createdAt: new Date("2026-01-01"),
  },
  {
    id: "u2",
    firstName: "Bob",
    lastName: "Dupont",
    email: "bob.dupont@example.gouv.fr",
    isValidated: false,
    isAdmin: true,
    createdAt: new Date("2026-02-01"),
  },
];

describe("fetchUsersTableData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as never);
    vi.mocked(prisma.user.count).mockResolvedValue(2);
  });

  it("retourne les utilisateurs paginés avec le tri par défaut (nom asc)", async () => {
    const result = await fetchUsersTableData({});

    expect(result.rows).toEqual(mockUsers);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(30);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { lastName: { sort: "asc", nulls: "last" } },
        skip: 0,
        take: 30,
      }),
    );
  });

  it("applique la recherche texte libre sur nom, prénom et email", async () => {
    await fetchUsersTableData({ dahliaq: "martin" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { lastName: { contains: "martin", mode: "insensitive" } },
            { firstName: { contains: "martin", mode: "insensitive" } },
            { email: { contains: "martin", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applique les filtres à facette nom / prenom / email", async () => {
    await fetchUsersTableData({ dahliaq: "nom:Dupont prenom:Bob email:gouv.fr" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { lastName: { contains: "Dupont", mode: "insensitive" } },
            { firstName: { contains: "Bob", mode: "insensitive" } },
            { email: { contains: "gouv.fr", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("trie par email décroissant quand demandé", async () => {
    await fetchUsersTableData({ sortBy: "email", sortOrder: "descending" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { email: "desc" },
      }),
    );
  });

});
