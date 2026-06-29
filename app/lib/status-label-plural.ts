type StatusCaptionLabels = {
  singular: string;
  plural: string;
};

// Status labels as stored in `statuses.label` → caption wording after « X dossier(s) ».
const STATUS_LABEL_PLURAL: Record<string, StatusCaptionLabels> = {
  "Clôture d'instruction": {
    singular: "en clôture d'instruction",
    plural: "en clôture d'instruction",
  },
  "Demande d'execution": {
    singular: "en cours de demande d'exécution",
    plural: "en cours de demandes d'exécution",
  },
  "En cours d'instruction": {
    singular: "en cours d'instruction",
    plural: "en cours d'instruction",
  },
  "En cours de régularisation": {
    singular: "en cours de régularisation",
    plural: "en cours de régularisation",
  },
  "En délibéré": {
    singular: "en délibéré",
    plural: "en délibéré",
  },
  Enregistré: {
    singular: "enregistré",
    plural: "enregistrés",
  },
  "Expertise en cours": {
    singular: "expertise en cours",
    plural: "expertises en cours",
  },
  "Inscrit au rôle d'une audience": {
    singular: "inscrit au rôle d'une audience",
    plural: "inscrits au rôle d'une audience",
  },
  "Recours en appel ou en cassation": {
    singular: "en recours en appel ou en cassation",
    plural: "en recours en appel ou en cassation",
  },
  Terminé: {
    singular: "terminé",
    plural: "terminés",
  },
};

export function statusLabelForCount(count: number, statusLabel: string): string {
  const captions = STATUS_LABEL_PLURAL[statusLabel];
  if (!captions) return statusLabel;
  return count <= 1 ? captions.singular : captions.plural;
}
