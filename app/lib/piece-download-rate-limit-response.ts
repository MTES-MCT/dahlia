import { TelerecoursUserRateLimitedError } from "@/app/lib/telerecours-user-rate-limited-error";
import type { TelerecoursSyncRateLimitDecision } from "@/app/lib/telerecours-sync-rate-limit";

export function throwIfTelerecoursRateLimited(
  decision: TelerecoursSyncRateLimitDecision,
): asserts decision is { allowed: true } {
  if (decision.allowed) return;
  if (decision.limited) {
    throw new TelerecoursUserRateLimitedError(decision.error, decision.retryAfterSeconds);
  }
  throw new Error(decision.error);
}

export function rateLimitedHttpResponse(error: TelerecoursUserRateLimitedError): Response {
  return new Response(error.message, {
    status: 429,
    headers: { "Retry-After": String(error.retryAfterSeconds) },
  });
}
