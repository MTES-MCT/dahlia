import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { createUserFormAction, deleteUserFormAction, updateUserFormAction } from "./actions";

const mockGetSession = vi.fn();
const mockRevalidatePath = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserDelete = vi.fn();
const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

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
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
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

function buildFormData(
  fields: Record<string, string>,
  // Repeated fields, e.g. the `jurisdictionIds` multiple select.
  multiValueFields: Record<string, string[]> = {},
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  for (const [key, values] of Object.entries(multiValueFields)) {
    for (const value of values) {
      formData.append(key, value);
    }
  }
  return formData;
}

function mockAdminSession(userId = "admin-1") {
  mockGetSession.mockResolvedValue({
    user: { id: userId, isAdmin: true, isValidated: true },
  });
}

type AuditEvent = {
  type: string;
  timestamp: string;
  actorId: string;
  action: string;
  target: Record<string, unknown>;
};

function auditEvents(): AuditEvent[] {
  return infoSpy.mock.calls
    .map((call) => call[0])
    .filter((line): line is string => typeof line === "string")
    .map((line) => JSON.parse(line) as AuditEvent);
}

describe("admin users actions", () => {
  afterAll(() => {
    infoSpy.mockRestore();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(null);
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
      const createdId = (mockUserCreate.mock.calls[0]?.[0] as { data: { id: string } }).data.id;
      expect(auditEvents()).toEqual([
        expect.objectContaining({
          type: "audit",
          actorId: "admin-1",
          action: "user.create",
          target: {
            id: createdId,
            email: "alice.martin@example.gouv.fr",
            isAdmin: true,
            isValidated: true,
            jurisdictionIds: [],
          },
        }),
      ]);
      expect(auditEvents()[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("crée le périmètre de droit à partir des juridictions sélectionnées", async () => {
      mockAdminSession();
      mockUserCreate.mockResolvedValue({});

      const result = await createUserFormAction(
        null,
        buildFormData({ email: "alice@example.gouv.fr" }, { jurisdictionIds: ["1", "3", "1"] }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          // Duplicates are collapsed, order preserved.
          jurisdictionScopes: { create: [{ jurisdictionId: 1 }, { jurisdictionId: 3 }] },
        }),
      });
    });

    it("crée un périmètre vide quand aucune juridiction n'est sélectionnée", async () => {
      mockAdminSession();
      mockUserCreate.mockResolvedValue({});

      await createUserFormAction(null, buildFormData({ email: "alice@example.gouv.fr" }));

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ jurisdictionScopes: { create: [] } }),
      });
    });

    it("refuse un identifiant de juridiction invalide", async () => {
      mockAdminSession();

      const result = await createUserFormAction(
        null,
        buildFormData({ email: "alice@example.gouv.fr" }, { jurisdictionIds: ["1", "abc"] }),
      );

      expect(result).toEqual({ ok: false, error: "Juridiction invalide." });
      expect(mockUserCreate).not.toHaveBeenCalled();
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
      expect(auditEvents()).toEqual([]);
    });
  });

  describe("updateUserFormAction", () => {
    it("met à jour l'utilisateur", async () => {
      mockAdminSession();
      mockUserUpdate.mockResolvedValue({});
      mockUserFindUnique.mockResolvedValue({
        email: "bob.old@example.gouv.fr",
        isAdmin: true,
        isValidated: false,
        jurisdictionScopes: [],
      });

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
          jurisdictionScopes: { deleteMany: {}, create: [] },
        },
      });
      expect(auditEvents()).toEqual([
        expect.objectContaining({
          type: "audit",
          actorId: "admin-1",
          action: "user.update",
          target: {
            id: "u2",
            email: "bob@example.gouv.fr",
            isAdmin: false,
            isValidated: true,
            jurisdictionIds: [],
            changes: {
              email: { from: "bob.old@example.gouv.fr", to: "bob@example.gouv.fr" },
              isAdmin: { from: true, to: false },
              isValidated: { from: false, to: true },
            },
          },
        }),
      ]);
    });

    it("remplace intégralement le périmètre de droit", async () => {
      mockAdminSession();
      mockUserUpdate.mockResolvedValue({});
      mockUserFindUnique.mockResolvedValue({
        email: "bob@example.gouv.fr",
        isAdmin: false,
        isValidated: false,
        jurisdictionScopes: [{ jurisdictionId: 1 }],
      });

      const result = await updateUserFormAction(
        null,
        buildFormData({ id: "u2", email: "bob@example.gouv.fr" }, { jurisdictionIds: ["2", "5"] }),
      );

      expect(result).toEqual({ ok: true });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "u2" },
        data: expect.objectContaining({
          jurisdictionScopes: {
            deleteMany: {},
            create: [{ jurisdictionId: 2 }, { jurisdictionId: 5 }],
          },
        }),
      });
      expect(auditEvents()[0]?.target.changes).toEqual({
        jurisdictionIds: { from: [1], to: [2, 5] },
      });
    });

    it("signale une juridiction inexistante", async () => {
      mockAdminSession();
      mockUserUpdate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint", {
          code: "P2003",
          clientVersion: "test",
        }),
      );

      const result = await updateUserFormAction(
        null,
        buildFormData({ id: "u2", email: "bob@example.gouv.fr" }, { jurisdictionIds: ["999"] }),
      );

      expect(result).toEqual({ ok: false, error: "Juridiction introuvable." });
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
      expect(auditEvents()).toEqual([]);
    });
  });

  describe("deleteUserFormAction", () => {
    it("supprime un autre utilisateur", async () => {
      mockAdminSession("admin-1");
      mockUserFindUnique.mockResolvedValue({ email: "bob@example.gouv.fr" });
      mockUserDelete.mockResolvedValue({});

      const result = await deleteUserFormAction(null, buildFormData({ id: "u2" }));

      expect(result).toEqual({ ok: true });
      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "u2" } });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
      expect(auditEvents()).toEqual([
        expect.objectContaining({
          type: "audit",
          actorId: "admin-1",
          action: "user.delete",
          target: { id: "u2", email: "bob@example.gouv.fr" },
        }),
      ]);
    });

    it("refuse l'auto-suppression", async () => {
      mockAdminSession("admin-1");

      const result = await deleteUserFormAction(null, buildFormData({ id: "admin-1" }));

      expect(result).toEqual({
        ok: false,
        error: "Vous ne pouvez pas supprimer votre propre compte.",
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(auditEvents()).toEqual([]);
    });
  });
});
