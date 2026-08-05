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

async function seedJurisdictions(): Promise<{ lyon: number; paris: number }> {
  const lyon = await testPrisma.jurisdiction.create({
    data: { name: "Tribunal administratif de Lyon", shortName: "TA069" },
  });
  const paris = await testPrisma.jurisdiction.create({
    data: { name: "Tribunal administratif de Paris", shortName: "TA075" },
  });
  return { lyon: lyon.id, paris: paris.id };
}

async function scopeShortNames(userId: string): Promise<string[]> {
  const scopes = await testPrisma.userJurisdictionScope.findMany({
    where: { userId },
    select: { jurisdiction: { select: { shortName: true } } },
    orderBy: { jurisdiction: { shortName: "asc" } },
  });
  return scopes.map((scope) => scope.jurisdiction.shortName);
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

  it("enregistre puis remplace le périmètre de droit", async () => {
    const { lyon, paris } = await seedJurisdictions();

    const created = await createUserFormAction(
      null,
      buildFormData(
        { email: "scope@example.gouv.fr", isValidated: "on" },
        { jurisdictionIds: [String(lyon), String(paris)] },
      ),
    );
    expect(created).toEqual({ ok: true });

    const user = await testPrisma.user.findUniqueOrThrow({
      where: { email: "scope@example.gouv.fr" },
    });
    expect(await scopeShortNames(user.id)).toEqual(["TA069", "TA075"]);

    const updated = await updateUserFormAction(
      null,
      buildFormData(
        { id: user.id, email: "scope@example.gouv.fr", isValidated: "on" },
        { jurisdictionIds: [String(paris)] },
      ),
    );
    expect(updated).toEqual({ ok: true });
    expect(await scopeShortNames(user.id)).toEqual(["TA075"]);

    // No selection at all clears the scope entirely.
    const cleared = await updateUserFormAction(
      null,
      buildFormData({ id: user.id, email: "scope@example.gouv.fr", isValidated: "on" }),
    );
    expect(cleared).toEqual({ ok: true });
    expect(await scopeShortNames(user.id)).toEqual([]);
  });

  it("supprime le périmètre de droit en cascade avec l'utilisateur", async () => {
    const { lyon } = await seedJurisdictions();

    await createUserFormAction(
      null,
      buildFormData({ email: "cascade@example.gouv.fr" }, { jurisdictionIds: [String(lyon)] }),
    );
    const user = await testPrisma.user.findUniqueOrThrow({
      where: { email: "cascade@example.gouv.fr" },
    });
    expect(await scopeShortNames(user.id)).toEqual(["TA069"]);

    expect(await deleteUserFormAction(null, buildFormData({ id: user.id }))).toEqual({ ok: true });
    expect(await testPrisma.userJurisdictionScope.count({ where: { userId: user.id } })).toBe(0);
    // The jurisdiction itself must survive the user deletion.
    expect(await testPrisma.jurisdiction.count()).toBe(2);
  });

  it("refuse une juridiction inexistante", async () => {
    const result = await createUserFormAction(
      null,
      buildFormData({ email: "bad.scope@example.gouv.fr" }, { jurisdictionIds: ["999999"] }),
    );

    expect(result).toEqual({ ok: false, error: "Juridiction introuvable." });
    expect(
      await testPrisma.user.findUnique({ where: { email: "bad.scope@example.gouv.fr" } }),
    ).toBeNull();
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
