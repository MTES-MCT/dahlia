import { describe, expect, it } from "vitest";
import {
  CASE_FILES_DASHBOARD_COLUMNS,
  CASE_FILES_EXPORT_COLUMNS,
  getMemoryDeadlineSource,
  type CaseFileDashboardRow,
} from "@/app/lib/case-files-dashboard-columns";

function buildCaseFile(overrides: Partial<CaseFileDashboardRow> = {}): CaseFileDashboardRow {
  return {
    caseFileNumber: "TA069/12345",
    title: "  Recours DALO  ",
    litigationType: null,
    rightType: null,
    summary: null,
    depositDate: null,
    memoryDeadlineDate: null,
    productionDeadlineDate: null,
    productionDeadlineType: null,
    caseFileActors: [],
    caseFileTags: [
      { tag: { id: 1, label: "Urgent" } },
      { tag: { id: 2, label: "À relancer" } },
    ],
    lastProducer: null,
    lastStatus: { id: 1, label: "En cours d'instruction" },
    lastHearing: null,
    ...overrides,
  } as CaseFileDashboardRow;
}

function exportValueFor(key: string, caseFile: CaseFileDashboardRow): string {
  const column = CASE_FILES_EXPORT_COLUMNS.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`Missing export column: ${key}`);
  return column.exportValue(caseFile);
}

const productionDeadlineDate = new Date(2024, 5, 15);
const convocationDate = new Date(2024, 6, 1);

describe("getMemoryDeadlineSource", () => {
  it("retourne CLOTURE_INSTRUCTION quand une date de production et le type correspondant sont définis", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        lastHearing: null,
      }),
    ).toBe("CLOTURE_INSTRUCTION");
  });

  it("retourne MISE_EN_DEMEURE_DE_PRODUIRE quand une date de production et le type correspondant sont définis", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "MISE_EN_DEMEURE_DE_PRODUIRE",
        lastHearing: null,
      }),
    ).toBe("MISE_EN_DEMEURE_DE_PRODUIRE");
  });

  it("retourne hearing quand seule la date de convocation d'audience est définie", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: { convocationDate },
      }),
    ).toBe("hearing");
  });

  it("retourne null quand aucune date n'est définie", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: null,
      }),
    ).toBeNull();
  });

  it("retourne null quand l'audience n'a pas de date de convocation", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: { convocationDate: null },
      }),
    ).toBeNull();
  });

  it("priorise la date de production sur l'audience quand les deux sont définies", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        lastHearing: { convocationDate },
      }),
    ).toBe("CLOTURE_INSTRUCTION");
  });

  it("retombe sur hearing quand une date de production est définie sans type reconnu", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: null,
        lastHearing: { convocationDate },
      }),
    ).toBe("hearing");
  });
});

describe("CASE_FILES_EXPORT_COLUMNS", () => {
  it("reprend les colonnes du tableau puis ajoute type d'échéance, statut, titre et tags", () => {
    expect(CASE_FILES_EXPORT_COLUMNS.map((column) => column.key)).toEqual([
      ...CASE_FILES_DASHBOARD_COLUMNS.map((column) => column.key),
      "memoryDeadlineSource",
      "lastStatus",
      "title",
      "tags",
    ]);
  });

  it("exporte le nom d'affichage du dossier sans y coller les tags", () => {
    expect(exportValueFor("caseFileNumber", buildCaseFile())).toBe("TA069/12345");
  });

  it("exporte le statut, le titre Télérecours et les tags dans des colonnes dédiées", () => {
    const caseFile = buildCaseFile();
    expect(exportValueFor("lastStatus", caseFile)).toBe("En cours d'instruction");
    expect(exportValueFor("title", caseFile)).toBe("Recours DALO");
    expect(exportValueFor("tags", caseFile)).toBe("Urgent, À relancer");
  });

  it("exporte un titre Télérecours et des tags vides quand ils sont absents", () => {
    const caseFile = buildCaseFile({ title: "   ", caseFileTags: [] });
    expect(exportValueFor("title", caseFile)).toBe("");
    expect(exportValueFor("tags", caseFile)).toBe("");
  });

  it("exporte Audience comme type d'échéance quand la date vient de la convocation", () => {
    expect(
      exportValueFor(
        "memoryDeadlineSource",
        buildCaseFile({ lastHearing: { convocationDate } as CaseFileDashboardRow["lastHearing"] }),
      ),
    ).toBe("Audience");
  });

  it("exporte Mise en demeure comme type d'échéance quand une date de production est définie", () => {
    expect(
      exportValueFor(
        "memoryDeadlineSource",
        buildCaseFile({
          productionDeadlineDate,
          productionDeadlineType: "MISE_EN_DEMEURE_DE_PRODUIRE",
        }),
      ),
    ).toBe("Mise en demeure");
  });

  it("exporte Clôture d'instruction comme type d'échéance", () => {
    expect(
      exportValueFor(
        "memoryDeadlineSource",
        buildCaseFile({
          productionDeadlineDate,
          productionDeadlineType: "CLOTURE_INSTRUCTION",
        }),
      ),
    ).toBe("Clôture d'instruction");
  });

  it("laisse le type d'échéance vide quand aucune date n'est définie", () => {
    expect(exportValueFor("memoryDeadlineSource", buildCaseFile())).toBe("");
  });
});
