/**
 * Append `detail` to `publicMessage` in development only.
 * Outside development the diagnostic is dropped: it can contain an internal
 * URL or a slice of an upstream response body.
 */
export function withDevelopmentDetail(publicMessage: string, detail: string): string {
  if (process.env.NODE_ENV === "development") {
    return `${publicMessage} : ${detail}`;
  }
  return publicMessage;
}
