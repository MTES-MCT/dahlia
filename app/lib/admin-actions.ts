import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/app/lib/auth";

export type AdminMutationResult = { ok: true } | { ok: false; error: string };

export type AdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export type ParseResult<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.isAdmin) {
    return { ok: false, error: "Accès réservé aux administrateurs." };
  }
  return { ok: true, userId: session.user.id };
}

export function parsePositiveIntField(
  formData: FormData,
  key: string,
  missingError: string,
): ParseResult<{ value: number }> {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number.parseInt(raw, 10);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: missingError };
  }
  return { ok: true, value };
}

export function parseRequiredText(
  formData: FormData,
  key: string,
  missingError: string,
): ParseResult<{ value: string }> {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    return { ok: false, error: missingError };
  }
  return { ok: true, value };
}

export function describePrismaError(
  error: unknown,
  knownErrors: Readonly<Partial<Record<string, string>>> = {},
): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = knownErrors[error.code];
    if (mapped) return mapped;
  }
  return error instanceof Error ? error.message : String(error);
}
