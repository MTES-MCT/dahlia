import "server-only";

import { withDevelopmentDetail } from "@/app/lib/development-detail";
import { describeError } from "@/data/telerecours/http";

/**
 * Message safe to send to the browser.
 * `describeError` includes the Télérecours URL and up to 400 characters of the
 * upstream body, so that diagnostic is appended only in development. The same
 * diagnostic is written to the server log as a single line: CR/LF from the
 * upstream body must not be able to forge extra log entries. The replacement
 * is the empty string: CodeQL's js/log-injection sanitizer only recognizes
 * `String#replace` when it deletes newlines, not when it swaps them for a space.
 */
export function clientErrorMessage(error: unknown, publicMessage: string): string {
  const detail = describeError(error);
  console.error(detail.replace(/\n|\r/g, ""));
  return withDevelopmentDetail(publicMessage, detail);
}
