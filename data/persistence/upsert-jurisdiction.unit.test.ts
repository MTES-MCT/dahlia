import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    mockUpsert.mockResolvedValue({ id: 42, jurisdictionCode: "TA069" });
  });

  afterEach(() => {
    delete process.env.TA069bis_TELERECOURS_JURISDICTION;
  });

  it("crée la juridiction avec le shortName et le code tribunal à la première importation", async () => {
    await upsertJurisdiction(prisma, "TA069");

    expect(mockUpsert).toHaveBeenCalledExactlyOnceWith({
      where: { shortName: "TA069" },
      update: {},
      create: { shortName: "TA069", jurisdictionCode: "TA069" },
    });
  });

  it("prend le code tribunal de <shortName>_TELERECOURS_JURISDICTION", async () => {
    process.env.TA069bis_TELERECOURS_JURISDICTION = "TA069";

    await upsertJurisdiction(prisma, "TA069bis");

    expect(mockUpsert).toHaveBeenCalledExactlyOnceWith({
      where: { shortName: "TA069bis" },
      update: {},
      create: { shortName: "TA069bis", jurisdictionCode: "TA069" },
    });
  });

  it("ne réécrit aucun champ quand la juridiction existe déjà", async () => {
    await upsertJurisdiction(prisma, "TA069");

    const call = mockUpsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };
    expect(call.update).toEqual({});
  });

  it("retourne l'id et le code tribunal de la juridiction", async () => {
    const jurisdiction = await upsertJurisdiction(prisma, "TA069");

    expect(jurisdiction).toEqual({ id: 42, jurisdictionCode: "TA069" });
  });

  it("refuse de continuer quand le code tribunal en base diffère de l'environnement", async () => {
    mockUpsert.mockResolvedValue({ id: 42, jurisdictionCode: "TA069" });
    process.env.TA069bis_TELERECOURS_JURISDICTION = "TA034";

    await expect(upsertJurisdiction(prisma, "TA069bis")).rejects.toThrow(
      'Jurisdiction TA069bis: court code "TA069" in database but "TA034" from the environment',
    );
  });
});
