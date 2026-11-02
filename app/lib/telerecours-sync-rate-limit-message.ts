// Public copy for a refused Télérecours call (sync or pièce download). No server
// imports in client components: they compare against this exact string. It
// matches a 60-second window (TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS).
export const TELERECOURS_USER_RATE_LIMIT_MESSAGE =
  "Trop d'appels Télérecours. Réessayez dans une minute.";

/** @deprecated Prefer TELERECOURS_USER_RATE_LIMIT_MESSAGE */
export const TELERECOURS_SYNC_RATE_LIMIT_MESSAGE = TELERECOURS_USER_RATE_LIMIT_MESSAGE;
