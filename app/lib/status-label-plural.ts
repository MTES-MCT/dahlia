type StatusCaptionLabels = {
  singular: string;
  plural: string;
};

// Status labels as stored in `statuses.label` → caption wording after « X dossier(s) ».
export const STATUS_LABEL_PLURAL: Record<string, StatusCaptionLabels> = {
  "Demande d'exécution": {
    singular: "en cours de demande d'exécution",
    plural: "en cours de demande d'exécution",
  },
  "Dossier rayé": {
    singular: "rayé",
    plural: "rayés",
  },
  "Dossier transmis suite recours": {
    singular: "transmis suite recours",
    plural: "transmis suite recours",
  },
  "En cours d'instruction": {
    singular: "en cours d'instruction",
    plural: "en cours d'instruction",
  },
  "En cours de déliberé": {
    singular: "en cours de déliberé",
    plural: "en cours de déliberé",
  },
  "En cours de régularisation": {
    singular: "en cours de régularisation",
    plural: "en cours de régularisation",
  },
  "Inscrit au rôle d'une audience": {
    singular: "inscrit au rôle d'une audience",
    plural: "inscrits au rôle d'une audience",
  },
  "Recours en appel": {
    singular: "en recours en appel",
    plural: "en recours en appel",
  },
  Terminé: {
    singular: "terminé",
    plural: "terminés",
  },
};

// Sorted status labels for the dashboard filter dropdown.
export const STATUS_FILTER_OPTIONS = Object.keys(STATUS_LABEL_PLURAL).sort((a, b) =>
  a.localeCompare(b, "fr"),
);

export function statusLabelForCount(count: number, statusLabel: string): string {
  const captions = STATUS_LABEL_PLURAL[statusLabel];
  if (!captions) return statusLabel;
  return count <= 1 ? captions.singular : captions.plural;
}
