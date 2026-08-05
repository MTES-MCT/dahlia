import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { updateDivisionFormAction } from "./actions";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockDivisionUpdate = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    legalEntityDivision: {
      update: (...args: unknown[]) => mockDivisionUpdate(...args),
    },
  },
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
  mockGetSession.mockResolvedValue({
    user: { id: userId, isAdmin: true, isValidated: true },
  });
}

describe("admin divisions actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateDivisionFormAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      const result = await updateDivisionFormAction(
        null,
        buildFormData({ id: "2488", name: "1ère chambre" }),
      );

      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs." });
      expect(mockDivisionUpdate).not.toHaveBeenCalled();
    });

    it("exige un identifiant valide", async () => {
      mockAdminSession();

      expect(await updateDivisionFormAction(null, buildFormData({ name: "1ère chambre" }))).toEqual(
        {
          ok: false,
          error: "Identifiant de division manquant.",
        },
      );
      expect(
        await updateDivisionFormAction(null, buildFormData({ id: "abc", name: "1ère chambre" })),
      ).toEqual({
        ok: false,
        error: "Identifiant de division manquant.",
      });
    });

    it("exige un nom non vide", async () => {
      mockAdminSession();

      expect(
        await updateDivisionFormAction(null, buildFormData({ id: "2488", name: "  " })),
      ).toEqual({
        ok: false,
        error: "Le nom est obligatoire.",
      });
      expect(mockDivisionUpdate).not.toHaveBeenCalled();
    });

    it("met à jour uniquement le nom", async () => {
      mockAdminSession();
      mockDivisionUpdate.mockResolvedValue({ id: 2488 });

      const result = await updateDivisionFormAction(
        null,
        buildFormData({ id: "2488", name: "  1ère chambre  " }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockDivisionUpdate).toHaveBeenCalledWith({
        where: { id: 2488 },
        data: { name: "1ère chambre" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/divisions");
    });

    it("signale une division introuvable", async () => {
      mockAdminSession();
      mockDivisionUpdate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );

      const result = await updateDivisionFormAction(
        null,
        buildFormData({ id: "99", name: "Inconnue" }),
      );

      expect(result).toEqual({ ok: false, error: "Division introuvable." });
    });
  });
});
