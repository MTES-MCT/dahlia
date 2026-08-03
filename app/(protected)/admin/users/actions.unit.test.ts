import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { createUserFormAction, deleteUserFormAction, updateUserFormAction } from "./actions";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserDelete = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      delete: (...args: unknown[]) => mockUserDelete(...args),
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

describe("admin users actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUserFormAction", () => {
    it("refuse les non-administrateurs", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1", isAdmin: false } });

      const result = await createUserFormAction(
        null,
        buildFormData({ email: "a@example.gouv.fr" }),
      );

      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs." });
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("exige un email valide", async () => {
      mockAdminSession();

      expect(await createUserFormAction(null, buildFormData({}))).toEqual({
        ok: false,
        error: "L'email est obligatoire.",
      });
      expect(await createUserFormAction(null, buildFormData({ email: "pas-un-email" }))).toEqual({
        ok: false,
        error: "L'email n'est pas valide.",
      });
    });

    it("crée un utilisateur avec les drapeaux du formulaire", async () => {
      mockAdminSession();
      mockUserCreate.mockResolvedValue({});

      const result = await createUserFormAction(
        null,
        buildFormData({
          email: "Alice.Martin@Example.gouv.fr",
          firstName: "Alice",
          lastName: "Martin",
          isValidated: "on",
          isAdmin: "on",
        }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "alice.martin@example.gouv.fr",
          firstName: "Alice",
          lastName: "Martin",
          name: "Alice Martin",
          isValidated: true,
          isAdmin: true,
          emailVerified: true,
        }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
    });

    it("signale un email déjà utilisé", async () => {
      mockAdminSession();
      mockUserCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      const result = await createUserFormAction(
        null,
        buildFormData({ email: "alice@example.gouv.fr" }),
      );

      expect(result).toEqual({
        ok: false,
        error: "Un utilisateur avec cet email existe déjà.",
      });
    });
  });

  describe("updateUserFormAction", () => {
    it("met à jour l'utilisateur", async () => {
      mockAdminSession();
      mockUserUpdate.mockResolvedValue({});

      const result = await updateUserFormAction(
        null,
        buildFormData({
          id: "u2",
          email: "bob@example.gouv.fr",
          firstName: "Bob",
          lastName: "Dupont",
          isValidated: "on",
        }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "u2" },
        data: {
          email: "bob@example.gouv.fr",
          firstName: "Bob",
          lastName: "Dupont",
          name: "Bob Dupont",
          emailVerified: true,
          isValidated: true,
          isAdmin: false,
        },
      });
    });

    it("empêche un admin de se retirer ses droits", async () => {
      mockAdminSession("admin-1");

      const result = await updateUserFormAction(
        null,
        buildFormData({
          id: "admin-1",
          email: "admin@example.gouv.fr",
        }),
      );

      expect(result).toEqual({
        ok: false,
        error: "Vous ne pouvez pas retirer vos propres droits d'administrateur.",
      });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("deleteUserFormAction", () => {
    it("supprime un autre utilisateur", async () => {
      mockAdminSession("admin-1");
      mockUserDelete.mockResolvedValue({});

      const result = await deleteUserFormAction(null, buildFormData({ id: "u2" }));

      expect(result).toEqual({ ok: true });
      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "u2" } });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
    });

    it("refuse l'auto-suppression", async () => {
      mockAdminSession("admin-1");

      const result = await deleteUserFormAction(null, buildFormData({ id: "admin-1" }));

      expect(result).toEqual({
        ok: false,
        error: "Vous ne pouvez pas supprimer votre propre compte.",
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
    });
  });
});
