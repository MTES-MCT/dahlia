import "server-only";
import { getTelerecoursCaseFileClient } from "@/data/telerecours/client";

// Default jurisdiction used when talking to Télérecours from the UI (refresh,
// file download, …). Centralised here so every server entry point agrees.
export const DEFAULT_JURISDICTION = "TA069";

// Build (or reuse) the Télérecours client for a jurisdiction, reading the
// matching credentials from the environment. Throws a readable error when the
// credentials are missing so callers can surface it to the user.
export function getTelerecoursClient(jurisdiction: string = DEFAULT_JURISDICTION) {
  const username = process.env[`${jurisdiction}_TELERECOURS_USERNAME`];
  const password = process.env[`${jurisdiction}_TELERECOURS_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Identifiants Télérecours manquants pour ${jurisdiction} ` +
        `(${jurisdiction}_TELERECOURS_USERNAME / _PASSWORD).`,
    );
  }
  return { client: getTelerecoursCaseFileClient({ username, password }), jurisdiction };
}
