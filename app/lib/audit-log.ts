// One JSON line per audit event on stdout (`"type":"audit"`), so a log drain
// can index who did what, and when. Denied attempts are included: they did not
// change persisted state, but they are the signal for brute force, privilege
// escalation and enumeration.

const OAUTH_CALLBACK_PATH = "/oauth2/callback/:providerId";

export type AdminAuditAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "tag.create"
  | "tag.update"
  | "tag.delete"
  | "division.update"
  | "jurisdiction.update";

export type SecurityAuditAction =
  | "auth.login.failed"
  | "auth.access.denied"
  | "auth.admin.denied"
  | "auth.scope.denied";

export type AdminAuditEvent = {
  actorId: string;
  action: AdminAuditAction;
  target: Record<string, unknown>;
};

export type SecurityDenialEvent = {
  actorId: string | null;
  action: SecurityAuditAction;
  reason: string;
  ip?: string | null;
  target?: Record<string, unknown>;
};

export function clientIpFrom(requestHeaders: Headers | undefined): string | null {
  if (!requestHeaders) return null;
  const forwarded = requestHeaders.get("x-forwarded-for");
  const raw = forwarded ?? requestHeaders.get("x-real-ip");
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  return first.slice(0, 64) || null;
}

// OAuth failures redirect to the error URL with `?error=<code>` (HTTP 302).
// Any other 4xx/5xx on the callback is a failed login too. A redirect without
// `error` is a successful sign-in and is not logged here.
export function oauthCallbackDenial(input: {
  path: string | undefined;
  statusCode: number | undefined;
  location: string | null;
}): { reason: string } | null {
  if (input.path !== OAUTH_CALLBACK_PATH) return null;
  const fromLocation = errorCodeFromRedirect(input.location);
  if (fromLocation) return { reason: fromLocation };
  if (input.statusCode !== undefined && input.statusCode >= 400) {
    return { reason: `http_${input.statusCode}` };
  }
  return null;
}

export function logAdminAudit(event: AdminAuditEvent): void {
  console.info(
    JSON.stringify({
      type: "audit",
      timestamp: new Date().toISOString(),
      actorId: event.actorId,
      action: event.action,
      target: event.target,
    }),
  );
}

export function logSecurityDenial(event: SecurityDenialEvent): void {
  const reason = sanitizeReason(event.reason);
  console.info(
    JSON.stringify({
      type: "audit",
      timestamp: new Date().toISOString(),
      outcome: "denied",
      actorId: event.actorId,
      action: event.action,
      reason,
      ip: event.ip ?? null,
      ...(event.target ? { target: event.target } : {}),
    }),
  );
}

function sanitizeReason(reason: string): string {
  const trimmed = reason.trim().slice(0, 80);
  return /^[A-Za-z0-9_.:-]+$/.test(trimmed) ? trimmed : "unspecified";
}

function errorCodeFromRedirect(location: string | null): string | null {
  if (!location) return null;
  try {
    const error = new URL(location, "https://audit.local").searchParams.get("error");
    return error ? sanitizeReason(error) : null;
  } catch {
    return null;
  }
}
