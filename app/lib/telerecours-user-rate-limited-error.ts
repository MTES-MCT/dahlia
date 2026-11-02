// Thrown when a Télérecours-backed route refuses the call because the per-user
// budget is spent. Route handlers map this to HTTP 429 + Retry-After.
export class TelerecoursUserRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "TelerecoursUserRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
