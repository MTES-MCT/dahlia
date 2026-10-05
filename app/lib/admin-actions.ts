import { headers } from "next/headers";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import { auth } from "@/app/lib/auth";

export type AdminMutationResult = { ok: true } | { ok: false; error: string };

export type AdminAuthResult = { ok: true; userId: string } | { ok: false; error: string };

// Validation is required in addition to the admin role, matching the protected
// layout and case-file scope. An unvalidated admin must not reach admin actions
// (including self-validation).
export async function requireAdmin(): Promise<AdminAuthResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.isValidated || !session.user.isAdmin) {
    const reason = !session?.user
      ? "unauthenticated"
      : !session.user.isValidated
        ? "not_validated"
        : "not_admin";
    logSecurityDenial({
      action: "auth.admin.denied",
      actorId: session?.user?.id ?? null,
      reason,
      ip: clientIpFrom(requestHeaders),
    });
    return { ok: false, error: "Accès réservé aux administrateurs." };
  }
  return { ok: true, userId: session.user.id };
}

type AdminContext = Extract<AdminAuthResult, { ok: true }>;

/**
 * Wraps a Server Action so `requireAdmin()` runs once before the handler.
 * On success, the authenticated admin context is passed as the first argument.
 */
export function withAdminAction<Args extends unknown[]>(
  action: (admin: AdminContext, ...args: Args) => Promise<AdminMutationResult>,
): (...args: Args) => Promise<AdminMutationResult> {
  return async (...args: Args): Promise<AdminMutationResult> => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return action(admin, ...args);
  };
}
