"use server";

import { revalidatePath } from "next/cache";
import { type AdminMutationResult, withAdminAction } from "@/app/lib/admin-actions";
import { logAdminAudit } from "@/app/lib/audit-log";
import { type ParseResult, describePrismaError } from "@/app/lib/form-actions";
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

type UserAuditSnapshot = {
  email: string;
  isAdmin: boolean;
  isValidated: boolean;
  jurisdictionIds: number[];
};

type AuditFieldChange = { from: unknown; to: unknown };

function sameIdSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

// Only sensitive fields are diffed. A name-only edit still emits an audit
// line (resulting state), without a `changes` object.
function userAuditChanges(
  previous: UserAuditSnapshot,
  next: UserAuditSnapshot,
): Record<string, AuditFieldChange> {
  const changes: Record<string, AuditFieldChange> = {};
  if (previous.email !== next.email) {
    changes.email = { from: previous.email, to: next.email };
  }
  if (previous.isAdmin !== next.isAdmin) {
    changes.isAdmin = { from: previous.isAdmin, to: next.isAdmin };
  }
  if (previous.isValidated !== next.isValidated) {
    changes.isValidated = { from: previous.isValidated, to: next.isValidated };
  }
  if (!sameIdSet(previous.jurisdictionIds, next.jurisdictionIds)) {
    changes.jurisdictionIds = {
      from: previous.jurisdictionIds,
      to: next.jurisdictionIds,
    };
  }
  return changes;
}

export const createUserFormAction = withAdminAction(
  async (admin, _prevState: UserMutationResult | null, formData: FormData) => {
    const parsedEmail = parseEmail(formData);
    if (!parsedEmail.ok) return parsedEmail;

    const parsedJurisdictions = parseJurisdictionIds(formData);
    if (!parsedJurisdictions.ok) return parsedJurisdictions;

    const firstName = parseOptionalText(formData, "firstName");
    const lastName = parseOptionalText(formData, "lastName");
    const isValidated = parseBooleanFlag(formData, "isValidated");
    const isAdmin = parseBooleanFlag(formData, "isAdmin");

    const id = crypto.randomUUID();

    try {
      await prisma.user.create({
        data: {
          id,
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
      logAdminAudit({
        actorId: admin.userId,
        action: "user.create",
        target: {
          id,
          email: parsedEmail.email,
          isAdmin,
          isValidated,
          jurisdictionIds: parsedJurisdictions.jurisdictionIds,
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

    const next = {
      email: parsedEmail.email,
      isAdmin,
      isValidated,
      jurisdictionIds: parsedJurisdictions.jurisdictionIds,
    };

    try {
      const previous = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          isAdmin: true,
          isValidated: true,
          jurisdictionScopes: {
            select: { jurisdictionId: true },
            orderBy: { jurisdictionId: "asc" },
          },
        },
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: next.email,
          // Keep verified so a re-invited / edited user can still link ProConnect.
          emailVerified: true,
          name: buildDisplayName(firstName, lastName, next.email),
          firstName,
          lastName,
          isValidated: next.isValidated,
          isAdmin: next.isAdmin,
          // Full replacement of the permission scope, in a single transaction.
          jurisdictionScopes: {
            deleteMany: {},
            create: next.jurisdictionIds.map((jurisdictionId) => ({
              jurisdictionId,
            })),
          },
        },
      });
      const changes = previous
        ? userAuditChanges(
            {
              email: previous.email,
              isAdmin: previous.isAdmin,
              isValidated: previous.isValidated,
              jurisdictionIds: previous.jurisdictionScopes.map((scope) => scope.jurisdictionId),
            },
            next,
          )
        : {};
      logAdminAudit({
        actorId: admin.userId,
        action: "user.update",
        target: {
          id: userId,
          ...next,
          ...(Object.keys(changes).length > 0 ? { changes } : {}),
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
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      await prisma.user.delete({ where: { id: userId } });
      logAdminAudit({
        actorId: admin.userId,
        action: "user.delete",
        target: { id: userId, email: existing?.email ?? null },
      });
      revalidatePath(ADMIN_USERS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeUserPrismaError(error) };
    }
  },
);
