import "server-only";

import { withDevelopmentDetail } from "@/app/lib/development-detail";
import { describeError } from "@/data/telerecours/http";

/**
 * Message safe to send to the browser.
 * `describeError` includes the Télérecours URL and up to 400 characters of the
 * upstream body, so that diagnostic is appended only in development. The raw
 * error is always written to the server log.
 */
export function clientErrorMessage(error: unknown, publicMessage: string): string {
  console.error(error);
  return withDevelopmentDetail(publicMessage, describeError(error));
}
