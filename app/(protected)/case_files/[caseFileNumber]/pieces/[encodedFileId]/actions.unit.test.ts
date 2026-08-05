import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetchAttachedFile = vi.fn();
const mockAttachedFileUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/app/lib/data/attached-files", () => ({
  fetchAttachedFile: (...args: unknown[]) => mockFetchAttachedFile(...args),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    attachedFile: {
      update: (...args: unknown[]) => mockAttachedFileUpdate(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { savePieceMetadataAction } from "./actions";

const INPUT = { dahliaName: "Requête", number: "002", comment: "" };

describe("savePieceMetadataAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enregistre les métadonnées d'une pièce accessible", async () => {
    mockFetchAttachedFile.mockResolvedValue({ encodedFileId: "piece-1" });
    mockAttachedFileUpdate.mockResolvedValue({ caseFileNumber: "TA069-001" });

    expect(await savePieceMetadataAction("piece-1", INPUT)).toEqual({ ok: true });
    expect(mockAttachedFileUpdate).toHaveBeenCalledWith({
      where: { encodedFileId: "piece-1" },
      data: { dahliaName: "Requête", number: "002", comment: null },
      select: { caseFileNumber: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/case_files/TA069-001");
  });

  it("refuse une pièce hors du périmètre de droit", async () => {
    // `fetchAttachedFile` is scoped: it returns null both for an unknown pièce
    // and for one whose case file is out of scope.
    mockFetchAttachedFile.mockResolvedValue(null);

    expect(await savePieceMetadataAction("piece-interdite", INPUT)).toEqual({
      ok: false,
      error: "Pièce introuvable.",
    });
    expect(mockAttachedFileUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de pièce vide sans interroger la base", async () => {
    expect(await savePieceMetadataAction("  ", INPUT)).toEqual({
      ok: false,
      error: "Identifiant de pièce manquant.",
    });
    expect(mockFetchAttachedFile).not.toHaveBeenCalled();
  });

  it("refuse un numéro non numérique", async () => {
    const result = await savePieceMetadataAction("piece-1", { ...INPUT, number: "2a" });

    expect(result).toEqual({
      ok: false,
      error: "Le numéro ne doit contenir que des chiffres.",
    });
    expect(mockAttachedFileUpdate).not.toHaveBeenCalled();
  });
});
