import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { updateJurisdictionFormAction } from "./actions";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockJurisdictionUpdate = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    jurisdiction: {
      update: (...args: unknown[]) => mockJurisdictionUpdate(...args),
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

describe("admin jurisdiction actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateJurisdictionFormAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      const result = await updateJurisdictionFormAction(
        null,
        buildFormData({ id: "1", name: "Tribunal administratif de Lyon" }),
      );

      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs." });
      expect(mockJurisdictionUpdate).not.toHaveBeenCalled();
    });

    it("exige un identifiant valide", async () => {
      mockAdminSession();

      expect(await updateJurisdictionFormAction(null, buildFormData({ name: "Lyon" }))).toEqual({
        ok: false,
        error: "Identifiant de juridiction manquant.",
      });
      expect(
        await updateJurisdictionFormAction(null, buildFormData({ id: "abc", name: "Lyon" })),
      ).toEqual({
        ok: false,
        error: "Identifiant de juridiction manquant.",
      });
    });

    it("exige un nom non vide", async () => {
      mockAdminSession();

      expect(
        await updateJurisdictionFormAction(null, buildFormData({ id: "1", name: "  " })),
      ).toEqual({
        ok: false,
        error: "Le nom est obligatoire.",
      });
      expect(mockJurisdictionUpdate).not.toHaveBeenCalled();
    });

    it("met à jour uniquement le nom", async () => {
      mockAdminSession();
      mockJurisdictionUpdate.mockResolvedValue({ id: 1 });

      const result = await updateJurisdictionFormAction(
        null,
        buildFormData({ id: "1", name: "  Tribunal administratif de Lyon  " }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockJurisdictionUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: "Tribunal administratif de Lyon" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/jurisdiction");
    });

    it("signale une juridiction introuvable", async () => {
      mockAdminSession();
      mockJurisdictionUpdate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );

      const result = await updateJurisdictionFormAction(
        null,
        buildFormData({ id: "99", name: "Inconnue" }),
      );

      expect(result).toEqual({ ok: false, error: "Juridiction introuvable." });
    });
  });
});
