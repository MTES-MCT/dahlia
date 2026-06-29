import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFileTabNav } from "./case-file-tab-nav";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

describe("CaseFileTabNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche les trois onglets", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces">
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByRole("tab", { name: "Pièces" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Historique" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Debug" })).toBeTruthy();
  });

  it("affiche le contenu des enfants", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces">
        <p>Contenu de l&apos;onglet</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByText("Contenu de l'onglet")).toBeTruthy();
  });

  it("marque l'onglet sélectionné", () => {
    render(
      <CaseFileTabNav selectedTabId="historique">
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByRole("tab", { name: "Historique" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Pièces" }).getAttribute("aria-selected")).toBe("false");
  });

  it("navigue vers l'onglet sélectionné en mettant à jour ?tab au clic", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces">
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Historique" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("?tab=historique", { scroll: false });
  });

  it("conserve les autres paramètres d'URL au changement d'onglet", () => {
    setSearchParams("pcSort=nom&hiq=audience");

    render(
      <CaseFileTabNav selectedTabId="pieces">
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Debug" }));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("tab=debug");
    expect(pushedUrl).toContain("pcSort=nom");
    expect(pushedUrl).toContain("hiq=audience");
    expect(mockPush).toHaveBeenCalledWith(expect.any(String), { scroll: false });
  });
});
