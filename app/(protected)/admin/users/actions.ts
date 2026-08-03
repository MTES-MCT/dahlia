"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminMutationResult,
  type ParseResult,
  describePrismaError,
  requireAdmin,
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
  });
}

export async function createUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsedEmail = parseEmail(formData);
  if (!parsedEmail.ok) return parsedEmail;

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
      },
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeUserPrismaError(error) };
  }
}

export async function updateUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const userId = String(formData.get("id") ?? "").trim();
  if (!userId) {
    return { ok: false, error: "Identifiant utilisateur manquant." };
  }

  const parsedEmail = parseEmail(formData);
  if (!parsedEmail.ok) return parsedEmail;

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
      },
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeUserPrismaError(error) };
  }
}

export async function deleteUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

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
}
