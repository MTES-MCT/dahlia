import { describe, expect, it } from "vitest";
import { statusLabelForCount } from "@/app/lib/status-label-plural";

const STATUS_CAPTIONS = [
  {
    dbLabel: "Clôture d'instruction",
    singular: "en clôture d'instruction",
    plural: "en clôture d'instruction",
  },
  {
    dbLabel: "Demande d'execution",
    singular: "en cours de demande d'exécution",
    plural: "en cours de demandes d'exécution",
  },
  {
    dbLabel: "En cours d'instruction",
    singular: "en cours d'instruction",
    plural: "en cours d'instruction",
  },
  {
    dbLabel: "En cours de régularisation",
    singular: "en cours de régularisation",
    plural: "en cours de régularisation",
  },
  {
    dbLabel: "En délibéré",
    singular: "en délibéré",
    plural: "en délibéré",
  },
  {
    dbLabel: "Enregistré",
    singular: "enregistré",
    plural: "enregistrés",
  },
  {
    dbLabel: "Expertise en cours",
    singular: "expertise en cours",
    plural: "expertises en cours",
  },
  {
    dbLabel: "Inscrit au rôle d'une audience",
    singular: "inscrit au rôle d'une audience",
    plural: "inscrits au rôle d'une audience",
  },
  {
    dbLabel: "Recours en appel ou en cassation",
    singular: "en recours en appel ou en cassation",
    plural: "en recours en appel ou en cassation",
  },
  {
    dbLabel: "Terminé",
    singular: "terminé",
    plural: "terminés",
  },
] as const;

describe("statusLabelForCount", () => {
  describe.each(STATUS_CAPTIONS)("$dbLabel", ({ dbLabel, singular, plural }) => {
    it("retourne le libellé au singulier pour un seul dossier", () => {
      expect(statusLabelForCount(1, dbLabel)).toBe(singular);
    });

    it("retourne le libellé au pluriel pour plusieurs dossiers", () => {
      expect(statusLabelForCount(2, dbLabel)).toBe(plural);
    });
  });

  it("retourne le libellé au singulier quand le compteur vaut 0", () => {
    expect(statusLabelForCount(0, "Terminé")).toBe("terminé");
  });

  it("retombe sur le libellé BDD quand aucun mapping n'existe", () => {
    expect(statusLabelForCount(1, "Statut inconnu")).toBe("Statut inconnu");
    expect(statusLabelForCount(5, "Statut inconnu")).toBe("Statut inconnu");
  });
});
