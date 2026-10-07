import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
const KEY = { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" };

describe("savePieceMetadataAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enregistre les métadonnées d'une pièce accessible", async () => {
    mockFetchAttachedFile.mockResolvedValue({ encodedFileId: "piece-1" });
    mockAttachedFileUpdate.mockResolvedValue({});

    expect(await savePieceMetadataAction(KEY, "piece-1", INPUT)).toEqual({ ok: true });
    expect(mockFetchAttachedFile).toHaveBeenCalledWith(KEY, "piece-1");
    expect(mockAttachedFileUpdate).toHaveBeenCalledWith({
      where: {
        jurisdictionCode_encodedFileId: { jurisdictionCode: "TA069", encodedFileId: "piece-1" },
      },
      data: { dahliaName: "Requête", number: "002", comment: null },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/case_files/TA069/TA069-001");
  });

  it("refuse une pièce hors du périmètre de droit", async () => {
    // `fetchAttachedFile` is scoped: it returns null for an unknown pièce, for
    // one of another case file and for one whose case file is out of scope.
    mockFetchAttachedFile.mockResolvedValue(null);

    expect(await savePieceMetadataAction(KEY, "piece-interdite", INPUT)).toEqual({
      ok: false,
      error: "Pièce introuvable.",
    });
    expect(mockAttachedFileUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de pièce vide sans interroger la base", async () => {
    expect(await savePieceMetadataAction(KEY, "  ", INPUT)).toEqual({
      ok: false,
      error: "Identifiant de pièce manquant.",
    });
    expect(mockFetchAttachedFile).not.toHaveBeenCalled();
  });

  it("refuse un numéro non numérique", async () => {
    const result = await savePieceMetadataAction(KEY, "piece-1", { ...INPUT, number: "2a" });

    expect(result).toEqual({
      ok: false,
      error: "Le numéro ne doit contenir que des chiffres.",
    });
    expect(mockAttachedFileUpdate).not.toHaveBeenCalled();
  });

  it("masque le message Prisma brut en cas d'échec d'enregistrement", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetchAttachedFile.mockResolvedValue({ encodedFileId: "piece-1" });
    mockAttachedFileUpdate.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`encodedFileId`)"),
    );

    const result = await savePieceMetadataAction(KEY, "piece-1", INPUT);

    expect(result).toEqual({ ok: false, error: "Une erreur est survenue." });
  });
});
