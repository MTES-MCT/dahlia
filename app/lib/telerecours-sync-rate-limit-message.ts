// Public copy for a refused sync. No server imports: the client component
// compares against this exact string. It matches a 60-second window
// (TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS).
export const TELERECOURS_SYNC_RATE_LIMIT_MESSAGE =
  "Trop de synchronisations Télérecours. Réessayez dans une minute.";
