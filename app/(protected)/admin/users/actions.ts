"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminMutationResult,
  type ParseResult,
  describePrismaError,
  withAdminAction,
} from "@/app/lib/admin-actions";
import { prisma } from "@/app/lib/prisma";

export type UserMutationResult = AdminMutationResult;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_USERS_PATH = "/admin/users";

function parseOptionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function parseEmail(formData: FormData): ParseResult<{ email: string }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { ok: false, error: "L'email est obligatoire." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "L'email n'est pas valide." };
  }
  return { ok: true, email };
}

function parseBooleanFlag(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

// Permission scope: ids of the jurisdictions selected in the multiple select.
// No selection means an empty scope, which is a valid value.
function parseJurisdictionIds(formData: FormData): ParseResult<{ jurisdictionIds: number[] }> {
  const ids = new Set<number>();
  for (const raw of formData.getAll("jurisdictionIds")) {
    const id = Number.parseInt(String(raw), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "Juridiction invalide." };
    }
    ids.add(id);
  }
  return { ok: true, jurisdictionIds: [...ids] };
}

function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || email;
}

function describeUserPrismaError(error: unknown): string {
  return describePrismaError(error, {
    P2002: "Un utilisateur avec cet email existe déjà.",
    P2025: "Utilisateur introuvable.",
    P2003: "Juridiction introuvable.",
  });
}

export const createUserFormAction = withAdminAction(
  async (_admin, _prevState: UserMutationResult | null, formData: FormData) => {
    const parsedEmail = parseEmail(formData);
    if (!parsedEmail.ok) return parsedEmail;

    const parsedJurisdictions = parseJurisdictionIds(formData);
    if (!parsedJurisdictions.ok) return parsedJurisdictions;

    const firstName = parseOptionalText(formData, "firstName");
    const lastName = parseOptionalText(formData, "lastName");
    const isValidated = parseBooleanFlag(formData, "isValidated");
    const isAdmin = parseBooleanFlag(formData, "isAdmin");

    try {
      await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: parsedEmail.email,
          // Must be true so Better Auth can implicitly link ProConnect on first
          // login (requireLocalEmailVerified defaults to true).
          emailVerified: true,
          name: buildDisplayName(firstName, lastName, parsedEmail.email),
          firstName,
          lastName,
          isValidated,
          isAdmin,
          jurisdictionScopes: {
            create: parsedJurisdictions.jurisdictionIds.map((jurisdictionId) => ({
              jurisdictionId,
            })),
          },
        },
      });
      revalidatePath(ADMIN_USERS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeUserPrismaError(error) };
    }
  },
);

export const updateUserFormAction = withAdminAction(
  async (admin, _prevState: UserMutationResult | null, formData: FormData) => {
    const userId = String(formData.get("id") ?? "").trim();
    if (!userId) {
      return { ok: false, error: "Identifiant utilisateur manquant." };
    }

    const parsedEmail = parseEmail(formData);
    if (!parsedEmail.ok) return parsedEmail;

    const parsedJurisdictions = parseJurisdictionIds(formData);
    if (!parsedJurisdictions.ok) return parsedJurisdictions;

    const firstName = parseOptionalText(formData, "firstName");
    const lastName = parseOptionalText(formData, "lastName");
    const isValidated = parseBooleanFlag(formData, "isValidated");
    const isAdmin = parseBooleanFlag(formData, "isAdmin");

    if (userId === admin.userId && !isAdmin) {
      return {
        ok: false,
        error: "Vous ne pouvez pas retirer vos propres droits d'administrateur.",
      };
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: parsedEmail.email,
          // Keep verified so a re-invited / edited user can still link ProConnect.
          emailVerified: true,
          name: buildDisplayName(firstName, lastName, parsedEmail.email),
          firstName,
          lastName,
          isValidated,
          isAdmin,
          // Full replacement of the permission scope, in a single transaction.
          jurisdictionScopes: {
            deleteMany: {},
            create: parsedJurisdictions.jurisdictionIds.map((jurisdictionId) => ({
              jurisdictionId,
            })),
          },
        },
      });
      revalidatePath(ADMIN_USERS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeUserPrismaError(error) };
    }
  },
);

export const deleteUserFormAction = withAdminAction(
  async (admin, _prevState: UserMutationResult | null, formData: FormData) => {
    const userId = String(formData.get("id") ?? "").trim();
    if (!userId) {
      return { ok: false, error: "Identifiant utilisateur manquant." };
    }

    if (userId === admin.userId) {
      return { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." };
    }

    try {
      await prisma.user.delete({ where: { id: userId } });
      revalidatePath(ADMIN_USERS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeUserPrismaError(error) };
    }
  },
);
