import { normalizeForSearch } from "@/app/lib/case-file-search";

// Shared filter logic for the dashboard case-files table, used by both the page
// (paginated view) and the export route handler (xlsx download) so they always
// resolve the status group the same way.

// Status groups behind the dashboard toggle (`groupe` query param):
// - "termine" → closed case files (TERMINATED_STATUS_LABELS),
// - "en_cours" → every other status,
// - "tous" → no group filter.
export const STATUS_GROUPS = ["en_cours", "termine", "tous"] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export const DEFAULT_STATUS_GROUP: StatusGroup = "en_cours";

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  en_cours: "En cours",
  termine: "Terminé",
  tous: "Tous",
};

export const TERMINATED_STATUS_LABELS: readonly string[] = ["Terminé", "Dossier rayé"];

// Whether a status label (catalogue or facet value) counts as a closed case file.
export function isTerminatedStatusLabel(label: string): boolean {
  const normalized = normalizeForSearch(label.trim());
  return TERMINATED_STATUS_LABELS.some(
    (terminatedLabel) => normalizeForSearch(terminatedLabel) === normalized,
  );
}

// Resolve the status group from the `groupe` query param; unknown or absent
// values fall back to the default group.
export function resolveStatusGroup(groupeParam: string | undefined): StatusGroup {
  return STATUS_GROUPS.find((group) => group === groupeParam) ?? DEFAULT_STATUS_GROUP;
}

// Keep only the status labels belonging to `group`.
export function filterStatusOptionsByGroup(
  statusFilterOptions: string[],
  group: StatusGroup,
): string[] {
  if (group === "tous") return statusFilterOptions;
  const wantTerminated = group === "termine";
  return statusFilterOptions.filter(
    (label) => isTerminatedStatusLabel(label) === wantTerminated,
  );
}

// Whether a status label (as typed in a `statut:` facet, so compared
// accent/case-insensitively) belongs to `group`.
export function statusLabelBelongsToGroup(label: string, group: StatusGroup): boolean {
  if (group === "tous") return true;
  return isTerminatedStatusLabel(label) === (group === "termine");
}
