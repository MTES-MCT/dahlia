import { describe, expect, it } from "vitest";
import {
  classifyComedDecision,
  countComedDossiers,
  normalizeComedSearchName,
  residualWords,
  selectComedDecisions,
  type AttachedFileComedSource,
  type ComedNameSource,
} from "./match-comed-decision";

// Inputs mimic the stored normalized columns: lowercase, unaccented, separators kept.
function source(
  fileNameNormalized: string,
  overrides: Partial<ComedNameSource> = {},
): ComedNameSource {
  return {
    dahliaNameNormalized: "",
    fileNameNormalized,
    fileTypeLabel: "Requête",
    ...overrides,
  };
}

function file(overrides: Partial<AttachedFileComedSource> = {}): AttachedFileComedSource {
  return {
    encodedFileId: "enc-1",
    caseFileNumber: "2400001",
    fileName: "3_COMED_23.12.25.pdf",
    fileTypeLabel: "Notification",
    eventCreationDate: new Date("2025-12-23T00:00:00.000Z"),
    dahliaNameNormalized: "",
    fileNameNormalized: "3_comed_23.12.25.pdf",
    caseFile: { title: "DALO" },
    ...overrides,
  };
}

describe("normalizeComedSearchName", () => {
  it("joins the two normalized names and collapses separators, keeping the leading space", () => {
    expect(normalizeComedSearchName("", "3_comed_23.12.25.pdf")).toBe(" 3 comed 23 12 25 pdf");
    expect(normalizeComedSearchName("decision comed", "scan.pdf")).toBe("decision comed scan pdf");
  });
});

describe("classifyComedDecision", () => {
  it("marks a COMED-only name as certain (rule D)", () => {
    expect(classifyComedDecision(source("3_comed_23.12.25.pdf"))).toBe("certain");
    expect(classifyComedDecision(source("comed.pdf"))).toBe("certain");
    expect(classifyComedDecision(source("comed_12_janvier_2024.pdf"))).toBe("certain");
  });

  it("marks a rejection that only names the COMED as certain", () => {
    expect(classifyComedDecision(source("1_rejet_comed_17.12.24.pdf"))).toBe("certain");
  });

  it("marks an explicit COMED decision as certain, including the decicsion typo", () => {
    expect(classifyComedDecision(source("decision_comed.pdf"))).toBe("certain");
    expect(classifyComedDecision(source("decicsion_commission_de_mediation.pdf"))).toBe("certain");
    expect(
      classifyComedDecision(
        source("notification_de_la_decision_commission_departementale_de_mediation.pdf"),
      ),
    ).toBe("certain");
    expect(
      classifyComedDecision(source("decision_commission_du_droit_au_logement_opposable.pdf")),
    ).toBe("certain");
  });

  it("reads the author from the dahlia name as well as the file name", () => {
    expect(
      classifyComedDecision(source("scan.pdf", { dahliaNameNormalized: "decision de la comed" })),
    ).toBe("certain");
  });

  it("marks a DEC attacked act or litigated decision as probable", () => {
    expect(
      classifyComedDecision(source("acte_attaque_12.pdf", { fileTypeLabel: "Décision" })),
    ).toBe("probable");
    expect(classifyComedDecision(source("actes_attaques.pdf", { fileTypeLabel: "Décision" }))).toBe(
      "probable",
    );
    expect(
      classifyComedDecision(source("14_decision_litigieuse_3.pdf", { fileTypeLabel: "Décision" })),
    ).toBe("probable");
    expect(classifyComedDecision(source("decision.pdf", { fileTypeLabel: "Décision" }))).toBe(
      "probable",
    );
  });

  it("prefers certain over probable when the name also states the COMED", () => {
    expect(classifyComedDecision(source("decision_comed.pdf", { fileTypeLabel: "Décision" }))).toBe(
      "certain",
    );
  });

  it("drops anti-patterns, including through the DEC branch", () => {
    expect(classifyComedDecision(source("recours_comed.pdf"))).toBeNull();
    expect(classifyComedDecision(source("saisine_commission_dalo.pdf"))).toBeNull();
    expect(classifyComedDecision(source("courrier_comed.pdf"))).toBeNull();
    expect(classifyComedDecision(source("reglement_interieur_comed.pdf"))).toBeNull();
    expect(classifyComedDecision(source("jugement_annulant_la_decision_comed.pdf"))).toBeNull();
    expect(
      classifyComedDecision(source("decision_de_la_prefecture.pdf", { fileTypeLabel: "Décision" })),
    ).toBeNull();
    expect(
      classifyComedDecision(source("decision_recours.pdf", { fileTypeLabel: "Décision" })),
    ).toBeNull();
  });

  it("ignores a name that is neither a COMED decision nor a DEC attacked act", () => {
    expect(classifyComedDecision(source("decision.pdf"))).toBeNull();
    expect(classifyComedDecision(source("decision.pdf", { fileTypeLabel: null }))).toBeNull();
    expect(classifyComedDecision(source("comed_convocation.pdf"))).toBeNull();
    expect(classifyComedDecision(source("comedie.pdf"))).toBeNull();
    expect(
      classifyComedDecision(source("preference.pdf", { fileTypeLabel: "Décision" })),
    ).toBeNull();
  });
});

describe("residualWords", () => {
  it("drops the COMED mention, digits, the extension and function words", () => {
    const name = normalizeComedSearchName("", "1_rejet_comed_17.12.24.pdf");
    expect(residualWords(name)).toEqual(["rejet"]);
  });
});

describe("selectComedDecisions", () => {
  it("keeps matching pièces with their case file and counts distinct dossiers", () => {
    const decisions = selectComedDecisions([
      file(),
      file({
        encodedFileId: "enc-2",
        caseFileNumber: "2400001",
        fileName: "acte_attaque.pdf",
        fileNameNormalized: "acte_attaque.pdf",
        fileTypeLabel: "Décision",
        caseFile: { title: "DALO" },
      }),
      file({
        encodedFileId: "enc-3",
        caseFileNumber: "2400002",
        fileName: "recours_comed.pdf",
        fileNameNormalized: "recours_comed.pdf",
        caseFile: { title: "Rejeté" },
      }),
    ]);

    expect(decisions.map((decision) => decision.encodedFileId)).toEqual(["enc-1", "enc-2"]);
    expect(decisions[0]).toMatchObject({
      caseFileNumber: "2400001",
      caseFileTitle: "DALO",
      fileTypeLabel: "Notification",
      verdict: "certain",
    });
    expect(decisions[1].verdict).toBe("probable");
    expect(countComedDossiers(decisions)).toBe(1);
  });
});
