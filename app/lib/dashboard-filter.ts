// Shared filter logic for the dashboard case-files table, used by both the page
// (paginated view) and the export route handler (xlsx download) so they always
// resolve the `statut` filter the same way.

export const DEFAULT_STATUT = "Inscrit au rôle d'une audience";

// Resolve the effective status-label filter from the `statut` query param:
// - absent (undefined) → default status,
// - present and non-empty (after trim) → that status,
// - present but empty → no status filter (null).
export function resolveCurrentStatut(statutParam: string | undefined): string | null {
  if (statutParam === undefined) return DEFAULT_STATUT;
  return statutParam.trim() ? statutParam.trim() : null;
}
