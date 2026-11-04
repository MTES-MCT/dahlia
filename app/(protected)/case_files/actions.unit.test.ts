import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { deleteSavedSearchFormAction, saveSearchFormAction } from "./actions";

const mockGetCurrentUserId = vi.fn();
const mockCreate = vi.fn();
const mockDeleteMany = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/app/lib/case-file-scope", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    savedSearch: {
      create: (...args: unknown[]) => mockCreate(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const VALID_SAVE = { name: "Mes référés", query: "recours:Référé", statusGroup: "en_cours" };

describe("saveSearchFormAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockCreate.mockResolvedValue({ id: 1 });
  });

  it("enregistre la recherche pour l'utilisateur connecté", async () => {
    const result = await saveSearchFormAction(null, buildFormData(VALID_SAVE));

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "Mes référés",
        query: "recours:Référé",
        statusGroup: "en_cours",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/case_files");
  });

  it("refuse sans utilisateur validé", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const result = await saveSearchFormAction(null, buildFormData(VALID_SAVE));

    expect(result.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("exige un nom", async () => {
    const result = await saveSearchFormAction(null, buildFormData({ ...VALID_SAVE, name: "  " }));

    expect(result).toEqual({ ok: false, error: "Saisissez un nom pour la recherche." });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuse un nom de plus de 60 caractères", async () => {
    const result = await saveSearchFormAction(
      null,
      buildFormData({ ...VALID_SAVE, name: "a".repeat(61) }),
    );

    expect(result).toEqual({ ok: false, error: "Le nom ne doit pas dépasser 60 caractères." });
  });

  it("refuse une recherche vide", async () => {
    const result = await saveSearchFormAction(null, buildFormData({ ...VALID_SAVE, query: "" }));

    expect(result.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuse une catégorie de dossiers inconnue", async () => {
    const result = await saveSearchFormAction(
      null,
      buildFormData({ ...VALID_SAVE, statusGroup: "archive" }),
    );

    expect(result).toEqual({ ok: false, error: "Catégorie de dossiers invalide." });
  });

  it("signale un nom déjà utilisé", async () => {
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await saveSearchFormAction(null, buildFormData(VALID_SAVE));

    expect(result).toEqual({ ok: false, error: "Vous avez déjà une recherche portant ce nom." });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteSavedSearchFormAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("supprime uniquement une recherche de l'utilisateur connecté", async () => {
    const result = await deleteSavedSearchFormAction(null, buildFormData({ id: "7" }));

    expect(result).toEqual({ ok: true });
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: 7, userId: "user-1" } });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/case_files");
  });

  it("traite la recherche d'un autre utilisateur comme introuvable", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteSavedSearchFormAction(null, buildFormData({ id: "7" }));

    expect(result).toEqual({ ok: false, error: "Recherche introuvable." });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("refuse sans utilisateur validé", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const result = await deleteSavedSearchFormAction(null, buildFormData({ id: "7" }));

    expect(result.ok).toBe(false);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("refuse un identifiant invalide", async () => {
    const result = await deleteSavedSearchFormAction(null, buildFormData({ id: "abc" }));

    expect(result.ok).toBe(false);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});
