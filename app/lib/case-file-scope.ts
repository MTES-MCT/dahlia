// Permission scope enforcement. Every read and write touching a CaseFile (or one
// of its satellites: pièces, events) must go through this module, so the rule
// lives in exactly one place.
//
// The rule: a validated user only sees the case files whose jurisdiction belongs
// to their scope (`user_jurisdiction_scopes`). An administrator with an empty
// scope is the exception and sees everything — including case files with no
// jurisdiction. Anybody else with an empty scope sees nothing.
import { cache } from "react";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import { auth } from "@/app/lib/auth";
import type { CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";

// `unrestricted` is reserved to administrators with no assigned jurisdiction;
// everybody else is limited to `jurisdictionIds`, which may be empty (no access).
export type CaseFileScope = { unrestricted: boolean; jurisdictionIds: number[] };

const NO_ACCESS: CaseFileScope = { unrestricted: false, jurisdictionIds: [] };

// Memoized per request so the session is read once, however many data functions
// ask for the user during a single render.
const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// Validated user id for the current request, or null when there is no session
// or the account is not allowed into the app yet.
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser();
  if (!user?.isValidated) return null;
  return user.id;
});

// Validated administrator. An unvalidated admin is not an admin for this check,
// matching the protected layout and `requireAdmin`.
export const currentUserIsAdmin = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  return user?.isValidated === true && user.isAdmin === true;
});

// Memoized per request so the scope is read once, however many data functions
// ask for it during a single render.
export const getCurrentCaseFileScope = cache(async (): Promise<CaseFileScope> => {
  const user = await getSessionUser();

  if (!user?.isValidated) {
    return NO_ACCESS;
  }

  const scopes = await prisma.userJurisdictionScope.findMany({
    where: { userId: user.id },
    select: { jurisdictionId: true },
  });
  const jurisdictionIds = scopes.map((scope) => scope.jurisdictionId);

  if (user.isAdmin && jurisdictionIds.length === 0) {
    return { unrestricted: true, jurisdictionIds: [] };
  }

  return { unrestricted: false, jurisdictionIds };
});

function scopeWhere(scope: CaseFileScope): Prisma.CaseFileWhereInput {
  return scope.unrestricted ? {} : { jurisdictionId: { in: scope.jurisdictionIds } };
}

// In-memory counterpart of `scopeWhere`, for a case file already loaded through
// another (scoped) record. Same rule: a null jurisdiction is only visible to an
// unrestricted administrator.
export function isJurisdictionInScope(
  scope: CaseFileScope,
  jurisdictionId: number | null,
): boolean {
  if (scope.unrestricted) return true;
  return jurisdictionId !== null && scope.jurisdictionIds.includes(jurisdictionId);
}

// WHERE fragment to merge into every CaseFile query. An empty scope yields
// `IN ()`, which matches nothing — including case files with no jurisdiction at
// all. An administrator with no assigned jurisdiction gets an empty fragment,
// leaving the query untouched.
export async function caseFileScopeWhere(): Promise<Prisma.CaseFileWhereInput> {
  return scopeWhere(await getCurrentCaseFileScope());
}

// Same fragment, applied through the (mandatory) `caseFile` relation of the
// satellite tables (pièces, events).
export async function caseFileRelationScopeWhere(): Promise<{
  caseFile?: Prisma.CaseFileWhereInput;
}> {
  const scope = await getCurrentCaseFileScope();
  return scope.unrestricted ? {} : { caseFile: scopeWhere(scope) };
}

// Guard for Server Actions that mutate a case file without reading it first.
export async function canAccessCaseFile(key: CaseFileKey): Promise<boolean> {
  const count = await prisma.caseFile.count({
    where: {
      jurisdictionCode: key.jurisdictionCode,
      caseFileNumber: key.caseFileNumber,
      ...(await caseFileScopeWhere()),
    },
  });
  if (count > 0) return true;
  await logCaseFileScopeMiss({ resource: "case_file", ...key });
  return false;
}

// A scoped read that misses (unknown id or outside the caller's jurisdictions)
// is answered as 404. Record the attempt so enumeration is visible. The
// user-facing response stays indistinguishable from a missing record.
export async function logCaseFileScopeMiss(target: Record<string, string>): Promise<void> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  logSecurityDenial({
    action: "auth.scope.denied",
    actorId: session?.user?.id ?? null,
    reason: "out_of_scope",
    ip: clientIpFrom(requestHeaders),
    target,
  });
}
