import { describe, expect, it } from "vitest";
import { STATUS_LABEL_PLURAL, statusLabelForCount } from "@/app/lib/status-label-plural";

describe("statusLabelForCount", () => {
  describe.each(Object.entries(STATUS_LABEL_PLURAL))("%s", (dbLabel, captions) => {
    it("retourne le libellé au singulier pour un seul dossier", () => {
      expect(statusLabelForCount(1, dbLabel)).toBe(captions.singular);
    });

    it("retourne le libellé au pluriel pour plusieurs dossiers", () => {
      expect(statusLabelForCount(2, dbLabel)).toBe(captions.plural);
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
