"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export type UserMutationResult = { ok: true } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_USERS_PATH = "/admin/users";

type AdminSession = { userId: string };

async function requireAdmin(): Promise<AdminSession | UserMutationResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.isAdmin) {
    return { ok: false, error: "Accès réservé aux administrateurs." };
  }
  return { userId: session.user.id };
}

function isAdminSession(value: AdminSession | UserMutationResult): value is AdminSession {
  return "userId" in value;
}

function parseOptionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function parseEmail(formData: FormData): { email: string } | UserMutationResult {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { ok: false, error: "L'email est obligatoire." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "L'email n'est pas valide." };
  }
  return { email };
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

function describePrismaError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Un utilisateur avec cet email existe déjà.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "Utilisateur introuvable.";
  }
  return error instanceof Error ? error.message : String(error);
}

export async function createUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const parsedEmail = parseEmail(formData);
  if (!("email" in parsedEmail)) return parsedEmail;

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
    return { ok: false, error: describePrismaError(error) };
  }
}

export async function updateUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const userId = String(formData.get("id") ?? "").trim();
  if (!userId) {
    return { ok: false, error: "Identifiant utilisateur manquant." };
  }

  const parsedEmail = parseEmail(formData);
  if (!("email" in parsedEmail)) return parsedEmail;

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
    return { ok: false, error: describePrismaError(error) };
  }
}

export async function deleteUserFormAction(
  _prevState: UserMutationResult | null,
  formData: FormData,
): Promise<UserMutationResult> {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

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
    return { ok: false, error: describePrismaError(error) };
  }
}
