import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createTagFormAction,
  deleteTagFormAction,
  listTagCaseFilesAction,
  updateTagFormAction,
} from "./actions";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockTagCreate = vi.fn();
const mockTagUpdate = vi.fn();
const mockTagDelete = vi.fn();
const mockTagFindFirst = vi.fn();
const mockCaseFileTagCount = vi.fn();
const mockFetchTagCaseFiles = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    tag: {
      create: (...args: unknown[]) => mockTagCreate(...args),
      update: (...args: unknown[]) => mockTagUpdate(...args),
      delete: (...args: unknown[]) => mockTagDelete(...args),
      findFirst: (...args: unknown[]) => mockTagFindFirst(...args),
    },
    caseFileTag: {
      count: (...args: unknown[]) => mockCaseFileTagCount(...args),
    },
  },
}));

vi.mock("@/app/lib/data/tags", () => ({
  fetchTagCaseFiles: (...args: unknown[]) => mockFetchTagCaseFiles(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function mockAdminSession(userId = "admin-1") {
  mockGetSession.mockResolvedValue({ user: { id: userId, isAdmin: true, isValidated: true } });
}

describe("admin tags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTagFindFirst.mockResolvedValue(null);
    mockCaseFileTagCount.mockResolvedValue(0);
  });

  describe("createTagFormAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      const result = await createTagFormAction(
        null,
        buildFormData({ label: "Urgent", color: "pink-tuile" }),
      );

      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs." });
      expect(mockTagCreate).not.toHaveBeenCalled();
    });

    it("exige un libellé non vide", async () => {
      mockAdminSession();

      expect(await createTagFormAction(null, buildFormData({ label: "  " }))).toEqual({
        ok: false,
        error: "Le libellé est obligatoire.",
      });
      expect(mockTagCreate).not.toHaveBeenCalled();
    });

    it("refuse un libellé trop long", async () => {
      mockAdminSession();

      const result = await createTagFormAction(null, buildFormData({ label: "a".repeat(61) }));

      expect(result).toEqual({
        ok: false,
        error: "Le libellé ne doit pas dépasser 60 caractères.",
      });
    });

    it("refuse une couleur hors palette", async () => {
      mockAdminSession();

      const result = await createTagFormAction(
        null,
        buildFormData({ label: "Urgent", color: "chartreuse" }),
      );

      expect(result).toEqual({ ok: false, error: "Couleur invalide." });
      expect(mockTagCreate).not.toHaveBeenCalled();
    });

    it("retombe sur la couleur par défaut quand aucune n'est fournie", async () => {
      mockAdminSession();
      mockTagCreate.mockResolvedValue({ id: 1 });

      await createTagFormAction(null, buildFormData({ label: "Urgent" }));

      expect(mockTagCreate).toHaveBeenCalledWith({
        data: { label: "Urgent", color: "blue-ecume" },
      });
    });

    // Postgres `label @unique` is case-sensitive, so the friendlier rule lives here.
    it("refuse un libellé déjà pris, à la casse près", async () => {
      mockAdminSession();
      mockTagFindFirst.mockResolvedValue({ id: 7 });

      const result = await createTagFormAction(null, buildFormData({ label: "urgent" }));

      expect(result).toEqual({ ok: false, error: "Un tag porte déjà ce libellé." });
      expect(mockTagCreate).not.toHaveBeenCalled();
    });

    it("crée le tag et revalide la page d'administration", async () => {
      mockAdminSession();
      mockTagCreate.mockResolvedValue({ id: 1 });

      const result = await createTagFormAction(
        null,
        buildFormData({ label: "  Urgent  ", color: "pink-tuile" }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockTagCreate).toHaveBeenCalledWith({
        data: { label: "Urgent", color: "pink-tuile" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/tags");
    });
  });

  describe("updateTagFormAction", () => {
    it("exige un identifiant valide", async () => {
      mockAdminSession();

      expect(await updateTagFormAction(null, buildFormData({ label: "Urgent" }))).toEqual({
        ok: false,
        error: "Identifiant de tag manquant.",
      });
    });

    it("ignore le tag édité dans le contrôle d'unicité", async () => {
      mockAdminSession();
      mockTagUpdate.mockResolvedValue({ id: 1 });

      await updateTagFormAction(null, buildFormData({ id: "1", label: "Urgent" }));

      expect(mockTagFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 1 } }),
        }),
      );
    });

    it("met à jour le tag et revalide les dossiers", async () => {
      mockAdminSession();
      mockTagUpdate.mockResolvedValue({ id: 1 });

      const result = await updateTagFormAction(
        null,
        buildFormData({ id: "1", label: "Urgent", color: "green-menthe" }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockTagUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { label: "Urgent", color: "green-menthe" },
      });
      // The label is displayed on every case file carrying the tag.
      expect(mockRevalidatePath).toHaveBeenCalledWith("/case_files");
    });

    it("signale un tag introuvable", async () => {
      mockAdminSession();
      mockTagUpdate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );

      expect(await updateTagFormAction(null, buildFormData({ id: "99", label: "X" }))).toEqual({
        ok: false,
        error: "Tag introuvable.",
      });
    });
  });

  describe("deleteTagFormAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      const result = await deleteTagFormAction(null, buildFormData({ id: "1" }));

      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs." });
      expect(mockTagDelete).not.toHaveBeenCalled();
    });

    // Re-checked server-side: the count read at render time may be stale.
    it("refuse de supprimer un tag utilisé par des dossiers", async () => {
      mockAdminSession();
      mockCaseFileTagCount.mockResolvedValue(3);

      const result = await deleteTagFormAction(null, buildFormData({ id: "1" }));

      expect(result).toEqual({
        ok: false,
        error: "Ce tag est utilisé par 3 dossiers et ne peut pas être supprimé.",
      });
      expect(mockTagDelete).not.toHaveBeenCalled();
    });

    it("accorde le pluriel au nombre de dossiers", async () => {
      mockAdminSession();
      mockCaseFileTagCount.mockResolvedValue(1);

      const result = await deleteTagFormAction(null, buildFormData({ id: "1" }));

      expect(result).toEqual({
        ok: false,
        error: "Ce tag est utilisé par 1 dossier et ne peut pas être supprimé.",
      });
    });

    it("supprime un tag inutilisé", async () => {
      mockAdminSession();
      mockTagDelete.mockResolvedValue({ id: 1 });

      const result = await deleteTagFormAction(null, buildFormData({ id: "1" }));

      expect(result).toEqual({ ok: true });
      expect(mockTagDelete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/tags");
    });

    it("traduit la contrainte de clé étrangère", async () => {
      mockAdminSession();
      mockTagDelete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("FK", {
          code: "P2003",
          clientVersion: "test",
        }),
      );

      const result = await deleteTagFormAction(null, buildFormData({ id: "1" }));

      expect(result).toEqual({
        ok: false,
        error: "Ce tag est utilisé par des dossiers et ne peut pas être supprimé.",
      });
    });
  });

  describe("listTagCaseFilesAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      expect(await listTagCaseFilesAction(1)).toEqual({
        ok: false,
        error: "Accès réservé aux administrateurs.",
      });
      expect(mockFetchTagCaseFiles).not.toHaveBeenCalled();
    });

    it("rejette un identifiant invalide", async () => {
      mockAdminSession();

      expect(await listTagCaseFilesAction(0)).toEqual({
        ok: false,
        error: "Identifiant de tag manquant.",
      });
    });

    it("retourne les dossiers bloquant la suppression", async () => {
      mockAdminSession();
      const caseFiles = [{ caseFileNumber: "TA069/1", displayName: "TA069/1 - Dupont" }];
      mockFetchTagCaseFiles.mockResolvedValue(caseFiles);

      expect(await listTagCaseFilesAction(1)).toEqual({ ok: true, caseFiles });
      expect(mockFetchTagCaseFiles).toHaveBeenCalledWith(1);
    });
  });
});
