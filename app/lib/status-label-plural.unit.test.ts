import { describe, expect, it } from "vitest";
import { statusLabelForCount } from "@/app/lib/status-label-plural";

const STATUS_CAPTIONS = [
  {
    dbLabel: "Demande d'exécution",
    singular: "en cours de demande d'exécution",
    plural: "en cours de demande d'exécution",
  },
  {
    dbLabel: "Dossier rayé",
    singular: "rayé",
    plural: "rayés",
  },
  {
    dbLabel: "Dossier transmis suite recours",
    singular: "transmis suite recours",
    plural: "transmis suite recours",
  },
  {
    dbLabel: "En cours d'instruction",
    singular: "en cours d'instruction",
    plural: "en cours d'instruction",
  },
  {
    dbLabel: "En cours de déliberé",
    singular: "en cours de déliberé",
    plural: "en cours de déliberé",
  },
  {
    dbLabel: "En cours de régularisation",
    singular: "en cours de régularisation",
    plural: "en cours de régularisation",
  },
  {
    dbLabel: "Recours en appel",
    singular: "en recours en appel",
    plural: "en recours en appel",
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
