import { describe, it, expect, beforeEach, vi } from "vitest";
import { upsertLegalEntityDivision } from "./upsert-legal-entity-division";

const mockUpsert = vi.fn();

const prisma = {
  legalEntityDivision: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
} as never;

describe("upsertLegalEntityDivision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue(undefined);
  });

  it("crée la division avec nom et code à la première importation", async () => {
    await upsertLegalEntityDivision(prisma, {
      id: 2488,
      name: "DDETS du Rhône",
      shortName: "DDETS69",
    });

    expect(mockUpsert).toHaveBeenCalledExactlyOnceWith({
      where: { id: 2488 },
      update: { shortName: "DDETS69" },
      create: {
        id: 2488,
        name: "DDETS du Rhône",
        shortName: "DDETS69",
      },
    });
  });

  it("ne réécrit pas le nom quand la division existe déjà", async () => {
    await upsertLegalEntityDivision(prisma, {
      id: 2488,
      name: "Nom Télérecours écrasant",
      shortName: "DDETS69",
    });

    const call = mockUpsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(call.update).not.toHaveProperty("name");
    expect(call.update).toEqual({ shortName: "DDETS69" });
    expect(call.create).toHaveProperty("name", "Nom Télérecours écrasant");
  });
});
