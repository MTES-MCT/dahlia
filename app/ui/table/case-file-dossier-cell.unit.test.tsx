import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaseFileDossierCell } from "@/app/ui/table/case-file-dossier-cell";
import type { CaseFileDashboardRow } from "@/app/lib/case-files-dashboard-columns";

function buildCaseFile(overrides: Partial<CaseFileDashboardRow> = {}): CaseFileDashboardRow {
  return {
    caseFileNumber: "TA069/12345",
    title: "Titre du dossier",
    litigationType: null,
    rightType: null,
    summary: null,
    depositDate: null,
    memoryDeadlineDate: null,
    productionDeadlineDate: null,
    productionDeadlineType: null,
    caseFileActors: [],
    lastProducer: null,
    lastStatus: { id: 1, label: "En cours d'instruction", category: "INPROGRESS", groupId: 1 },
    lastHearing: null,
    ...overrides,
  } as CaseFileDashboardRow;
}

describe("CaseFileDossierCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le lien, le titre en italique et le badge de statut", () => {
    render(<CaseFileDossierCell caseFile={buildCaseFile()} href="/case_files/TA069%2F12345" />);

    const link = screen.getByRole("link", { name: "TA069/12345" });
    expect(link.getAttribute("href")).toBe("/case_files/TA069%2F12345");
    expect(screen.getByText("Titre du dossier").className).toContain("italic");
    expect(screen.getByText("En cours d'instruction")).toBeTruthy();
  });

  it("n'affiche pas le titre quand il est absent", () => {
    render(
      <CaseFileDossierCell
        caseFile={buildCaseFile({ title: null })}
        href="/case_files/TA069%2F12345"
      />,
    );

    expect(screen.queryByText("Titre du dossier")).toBeNull();
    expect(screen.getByText("En cours d'instruction")).toBeTruthy();
  });
});
