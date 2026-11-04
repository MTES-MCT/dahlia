import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchCurrentUserSavedSearches } from "./saved-searches";

const mockGetCurrentUserId = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/app/lib/case-file-scope", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: { savedSearch: { findMany: (...args: unknown[]) => mockFindMany(...args) } },
}));

describe("fetchCurrentUserSavedSearches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne lit que les recherches de l'utilisateur connecté, triées par nom", async () => {
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockFindMany.mockResolvedValue([
      { id: 1, name: "Référés", query: "recours:Référé", statusGroup: "termine" },
      { id: 2, name: "Ancienne", query: "dupont", statusGroup: "inconnu" },
    ]);

    const searches = await fetchCurrentUserSavedSearches();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, orderBy: { name: "asc" } }),
    );
    // An unknown stored tab falls back to the default one.
    expect(searches.map((search) => search.statusGroup)).toEqual(["termine", "en_cours"]);
  });

  it("ne renvoie rien sans utilisateur validé", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    expect(await fetchCurrentUserSavedSearches()).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
