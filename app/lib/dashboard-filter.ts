// Shared filter logic for the dashboard case-files table, used by both the page
// (paginated view) and the export route handler (xlsx download) so they always
// resolve the `statut` filter the same way.

export const PREFERRED_DEFAULT_STATUT = "Inscrit au rôle d'une audience";

const TERMINATED_STATUS_LABEL = "Terminé";

// Pick the default status filter from labels available in the database.
export function resolveDefaultStatut(statusFilterOptions: string[]): string | null {
  if (statusFilterOptions.includes(PREFERRED_DEFAULT_STATUT)) {
    return PREFERRED_DEFAULT_STATUT;
  }

  const activeOptions = statusFilterOptions.filter((label) => label !== TERMINATED_STATUS_LABEL);
  return activeOptions[0] ?? statusFilterOptions[0] ?? null;
}

// Resolve the effective status-label filter from the `statut` query param:
// - absent (undefined) → default status,
// - present and non-empty (after trim) → that status,
// - present but empty → no status filter (null).
export function resolveCurrentStatut(
  statutParam: string | undefined,
  defaultStatut: string | null,
): string | null {
  if (statutParam === undefined) return defaultStatut;
  return statutParam.trim() ? statutParam.trim() : null;
}
