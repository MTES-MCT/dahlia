import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFilesStatusGroupTabs } from "./case-files-status-group-tabs";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/case_files",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

const COUNTS = { en_cours: 12, termine: 3, tous: 15 };

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

describe("CaseFilesStatusGroupTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("dahliaq=statut:Terminé&page=2");
  });

  afterEach(() => {
    cleanup();
  });

  it("navigue vers le nouveau groupe en conservant tri et recherche", () => {
    render(
      <CaseFilesStatusGroupTabs currentGroup="en_cours" counts={COUNTS}>
        panel
      </CaseFilesStatusGroupTabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Terminés/ }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(mockPush.mock.calls[0][0] as string);
    expect(url).toContain("groupe=termine");
    expect(url).toContain("dahliaq=statut:Terminé");
    expect(url).not.toContain("page=");
  });

  it("retire une facette statut incompatible avec le groupe cible", () => {
    render(
      <CaseFilesStatusGroupTabs currentGroup="termine" counts={COUNTS}>
        panel
      </CaseFilesStatusGroupTabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /En cours/ }));

    const url = decodeURIComponent(mockPush.mock.calls[0][0] as string);
    expect(url).toContain("groupe=en_cours");
    expect(url).not.toContain("statut:");
  });

  it("affiche un onglet par groupe avec son compteur, l'onglet courant sélectionné", () => {
    render(
      <CaseFilesStatusGroupTabs currentGroup="termine" counts={COUNTS}>
        panel
      </CaseFilesStatusGroupTabs>,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "En cours12",
      "Terminés3",
      "Tous les dossiers15",
    ]);
    expect(screen.getByRole("tab", { name: /Terminés/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("panel");
  });

  it("ne navigue pas en cliquant sur l'onglet déjà sélectionné", () => {
    render(
      <CaseFilesStatusGroupTabs currentGroup="en_cours" counts={COUNTS}>
        panel
      </CaseFilesStatusGroupTabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /En cours/ }));

    expect(mockPush).not.toHaveBeenCalled();
  });
});
