import { describe, expect, it } from "vitest";
import { STATUS_FILTER_OPTIONS, STATUS_LABEL_PLURAL, statusLabelForCount } from "@/app/lib/status-label-plural";

describe("STATUS_FILTER_OPTIONS", () => {
  it("lists every known status label, sorted in French locale order", () => {
    expect(STATUS_FILTER_OPTIONS).toEqual(
      Object.keys(STATUS_LABEL_PLURAL).sort((a, b) => a.localeCompare(b, "fr")),
    );
  });
});

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
