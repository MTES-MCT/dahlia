import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";

export type AdminMutationResult = { ok: true } | { ok: false; error: string };

export type AdminAuthResult = { ok: true; userId: string } | { ok: false; error: string };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.isAdmin) {
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
