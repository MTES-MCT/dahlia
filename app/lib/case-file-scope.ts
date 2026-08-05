// Permission scope enforcement. Every read and write touching a CaseFile (or one
// of its satellites: pièces, events) must go through this module, so the rule
// lives in exactly one place.
//
// The rule: administrators see everything; anybody else only sees the case files
// whose jurisdiction belongs to their scope (`user_jurisdiction_scopes`). A case
// file with no jurisdiction is visible to administrators only.
import { cache } from "react";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

// `unrestricted` is reserved to administrators; everybody else is limited to
// `jurisdictionIds`, which may legitimately be empty (no access at all).
export type CaseFileScope = { unrestricted: boolean; jurisdictionIds: number[] };

const NO_ACCESS: CaseFileScope = { unrestricted: false, jurisdictionIds: [] };

// Memoized per request so the session and the scope are read once, however many
// data functions ask for them during a single render.
export const getCurrentCaseFileScope = cache(async (): Promise<CaseFileScope> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.isValidated) {
    return NO_ACCESS;
  }
  if (session.user.isAdmin) {
    return { unrestricted: true, jurisdictionIds: [] };
  }

  const scopes = await prisma.userJurisdictionScope.findMany({
    where: { userId: session.user.id },
    select: { jurisdictionId: true },
  });

  return { unrestricted: false, jurisdictionIds: scopes.map((scope) => scope.jurisdictionId) };
});

function scopeWhere(scope: CaseFileScope): Prisma.CaseFileWhereInput {
  return scope.unrestricted ? {} : { jurisdictionId: { in: scope.jurisdictionIds } };
}

// WHERE fragment to merge into every CaseFile query. An empty scope yields
// `IN ()`, which matches nothing — including case files with no jurisdiction at
// all. An administrator gets an empty fragment, leaving the query untouched.
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
export async function canAccessCaseFile(caseFileNumber: string): Promise<boolean> {
  const count = await prisma.caseFile.count({
    where: { caseFileNumber, ...(await caseFileScopeWhere()) },
  });
  return count > 0;
}
