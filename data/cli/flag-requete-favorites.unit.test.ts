import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { flagRequeteFavorites, parseFlagRequeteFavoritesArgs } from "./flag-requete-favorites";

describe("parseFlagRequeteFavoritesArgs", () => {
  it("defaults to every jurisdiction, for real", () => {
    expect(parseFlagRequeteFavoritesArgs([])).toEqual({ jurisdiction: null, dryRun: false });
  });

  it("reads --jurisdiction and --dry-run", () => {
    expect(parseFlagRequeteFavoritesArgs(["--jurisdiction", "TA069", "--dry-run"])).toEqual({
      jurisdiction: "TA069",
      dryRun: true,
    });
  });

  it("rejects --jurisdiction without a value", () => {
    expect(() => parseFlagRequeteFavoritesArgs(["--jurisdiction", "--dry-run"])).toThrow();
    expect(() => parseFlagRequeteFavoritesArgs(["--jurisdiction"])).toThrow();
  });
});

describe("flagRequeteFavorites", () => {
  const prisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

  beforeEach(() => {
    mockReset(prisma);
  });

  it("flags the not-yet-favorite REQ pièces of every jurisdiction", async () => {
    prisma.attachedFile.updateMany.mockResolvedValue({ count: 7040 });

    expect(await flagRequeteFavorites(prisma, { jurisdiction: null, dryRun: false })).toBe(7040);
    expect(prisma.attachedFile.updateMany).toHaveBeenCalledWith({
      where: { fileFamilyTypeCode: "REQ", isFavorite: false },
      data: { isFavorite: true },
    });
  });

  it("restricts to one jurisdiction", async () => {
    prisma.attachedFile.updateMany.mockResolvedValue({ count: 3 });

    await flagRequeteFavorites(prisma, { jurisdiction: "TA069", dryRun: false });
    expect(prisma.attachedFile.updateMany).toHaveBeenCalledWith({
      where: { fileFamilyTypeCode: "REQ", isFavorite: false, jurisdictionCode: "TA069" },
      data: { isFavorite: true },
    });
  });

  it("only counts in dry-run", async () => {
    prisma.attachedFile.count.mockResolvedValue(12);

    expect(await flagRequeteFavorites(prisma, { jurisdiction: null, dryRun: true })).toBe(12);
    expect(prisma.attachedFile.updateMany).not.toHaveBeenCalled();
  });
});
