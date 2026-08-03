import { describe, it, expect, beforeEach, vi } from "vitest";
import { upsertJurisdiction } from "./upsert-jurisdiction";

const mockUpsert = vi.fn();

const prisma = {
  jurisdiction: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
} as never;

describe("upsertJurisdiction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ id: 42 });
  });

  it("crée la juridiction avec le shortName à la première importation", async () => {
    await upsertJurisdiction(prisma, "TA069");

    expect(mockUpsert).toHaveBeenCalledExactlyOnceWith({
      where: { shortName: "TA069" },
      update: {},
      create: { shortName: "TA069" },
    });
  });

  it("ne réécrit aucun champ quand la juridiction existe déjà", async () => {
    await upsertJurisdiction(prisma, "TA069");

    const call = mockUpsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };
    expect(call.update).toEqual({});
  });

  it("retourne l'id de la juridiction", async () => {
    const id = await upsertJurisdiction(prisma, "TA069");

    expect(id).toBe(42);
  });
});
