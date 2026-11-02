/** Public app origin for redirects (behind Scalingo, request.url is often internal 127.0.0.1:PORT). */
export function appBaseUrl(request: Request): string {
  return process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
}
