import { Prisma } from "@prisma/client";

export type ParseResult<T extends Record<string, unknown>> =
  ({ ok: true } & T) | { ok: false; error: string };

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

const GENERIC_PERSISTENCE_ERROR = "Une erreur est survenue.";

// Known Prisma codes get a caller-supplied message. Anything else (unmapped
// code, validation error, connection failure) can embed column names and
// constraint details, so the client only sees a generic message; the raw
// error stays in the server log.
export function describePrismaError(
  error: unknown,
  knownErrors: Readonly<Partial<Record<string, string>>> = {},
): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = knownErrors[error.code];
    if (mapped) return mapped;
  }
  console.error(error);
  return GENERIC_PERSISTENCE_ERROR;
}
