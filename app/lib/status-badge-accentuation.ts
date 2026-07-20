export type StatusBadgeAccentuation =
  | "blue-cumulus"
  | "green-menthe"
  | "pink-tuile"
  | "yellow-moutarde";

export type StatusBadgeAccentuationClassName = `fr-badge--${StatusBadgeAccentuation}`;

const DEFAULT_STATUS_BADGE_ACCENTUATION: StatusBadgeAccentuation = "blue-cumulus";

// Status labels as stored in `statuses.label` → DSFR Badge accentuation for display.
export const STATUS_BADGE_ACCENTUATION: Record<string, StatusBadgeAccentuation> = {
  "Demande d'exécution": "blue-cumulus",
  "Dossier rayé": "pink-tuile",
  "Dossier transmis suite recours": "blue-cumulus",
  "En cours d'instruction": "blue-cumulus",
  "En cours de déliberé": "blue-cumulus",
  "En cours de régularisation": "yellow-moutarde",
  "Inscrit au rôle d'une audience": "yellow-moutarde",
  "Recours en appel": "yellow-moutarde",
  Terminé: "green-menthe",
};

export function statusBadgeAccentuation(statusLabel: string): StatusBadgeAccentuation {
  return STATUS_BADGE_ACCENTUATION[statusLabel] ?? DEFAULT_STATUS_BADGE_ACCENTUATION;
}

export function statusBadgeAccentuationClassName(
  statusLabel: string,
): StatusBadgeAccentuationClassName {
  return `fr-badge--${statusBadgeAccentuation(statusLabel)}`;
}
