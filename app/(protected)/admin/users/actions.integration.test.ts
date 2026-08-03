import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("@/app/lib/prisma", async () => {
  const { testPrisma } = await import("@/data/test-support/integration-db");
  return { prisma: testPrisma };
});

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { revalidatePath } from "next/cache";
import { createUserFormAction, deleteUserFormAction, updateUserFormAction } from "./actions";
import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";

const ADMIN_ID = "admin-integration";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

async function seedAdmin(): Promise<void> {
  await testPrisma.user.create({
    data: {
      id: ADMIN_ID,
      email: "admin@example.gouv.fr",
      emailVerified: true,
      name: "Admin Test",
      firstName: "Admin",
      lastName: "Test",
      isValidated: true,
      isAdmin: true,
    },
  });
  mockGetSession.mockResolvedValue({
    user: { id: ADMIN_ID, isAdmin: true, isValidated: true },
  });
}

describe("admin users CRUD (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    vi.mocked(revalidatePath).mockClear();
    mockGetSession.mockReset();
    await resetTestDatabase();
    await seedAdmin();
  });

  it("crée un utilisateur en base", async () => {
    const result = await createUserFormAction(
      null,
      buildFormData({
        email: "alice.martin@example.gouv.fr",
        firstName: "Alice",
        lastName: "Martin",
        isValidated: "on",
      }),
    );

    expect(result).toEqual({ ok: true });

    const created = await testPrisma.user.findUniqueOrThrow({
      where: { email: "alice.martin@example.gouv.fr" },
    });
    expect(created.firstName).toBe("Alice");
    expect(created.lastName).toBe("Martin");
    expect(created.emailVerified).toBe(true);
    expect(created.isValidated).toBe(true);
    expect(created.isAdmin).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("met à jour un utilisateur existant", async () => {
    const created = await testPrisma.user.create({
      data: {
        id: "user-to-update",
        email: "bob@example.gouv.fr",
        emailVerified: false,
        name: "Bob",
        firstName: "Bob",
        lastName: null,
        isValidated: false,
        isAdmin: false,
      },
    });

    const result = await updateUserFormAction(
      null,
      buildFormData({
        id: created.id,
        email: "bob.dupont@example.gouv.fr",
        firstName: "Bob",
        lastName: "Dupont",
        isValidated: "on",
        isAdmin: "on",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.email).toBe("bob.dupont@example.gouv.fr");
    expect(updated.lastName).toBe("Dupont");
    expect(updated.isValidated).toBe(true);
    expect(updated.isAdmin).toBe(true);
  });

  it("refuse un email déjà pris à la création", async () => {
    await testPrisma.user.create({
      data: {
        id: "existing",
        email: "taken@example.gouv.fr",
        emailVerified: false,
        name: "Taken",
        isValidated: false,
        isAdmin: false,
      },
    });

    const result = await createUserFormAction(
      null,
      buildFormData({ email: "taken@example.gouv.fr" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Un utilisateur avec cet email existe déjà.",
    });
  });

  it("supprime un utilisateur et refuse l'auto-suppression", async () => {
    const other = await testPrisma.user.create({
      data: {
        id: "user-to-delete",
        email: "delete.me@example.gouv.fr",
        emailVerified: false,
        name: "Delete Me",
        isValidated: false,
        isAdmin: false,
      },
    });

    const selfDelete = await deleteUserFormAction(null, buildFormData({ id: ADMIN_ID }));
    expect(selfDelete).toEqual({
      ok: false,
      error: "Vous ne pouvez pas supprimer votre propre compte.",
    });
    expect(await testPrisma.user.findUnique({ where: { id: ADMIN_ID } })).not.toBeNull();

    const result = await deleteUserFormAction(null, buildFormData({ id: other.id }));
    expect(result).toEqual({ ok: true });
    expect(await testPrisma.user.findUnique({ where: { id: other.id } })).toBeNull();
  });
});
