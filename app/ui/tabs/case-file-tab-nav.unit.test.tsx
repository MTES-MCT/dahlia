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

  it("affiche les onglets Synthèse, Historique et Pièces avec leurs compteurs", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces" eventCount={4} pieceCount={2}>
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByRole("tab", { name: "Synthèse" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Historique (4)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pièces (2)" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Debug" })).toBeNull();
  });

  it("affiche l'onglet Debug quand showDebugTab est activé", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces" eventCount={4} pieceCount={2} showDebugTab>
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByRole("tab", { name: "Debug" })).toBeTruthy();
  });

  it("affiche le contenu des enfants", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces" eventCount={4} pieceCount={2}>
        <p>Contenu de l&apos;onglet</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByText("Contenu de l'onglet")).toBeTruthy();
  });

  it("marque l'onglet sélectionné", () => {
    render(
      <CaseFileTabNav selectedTabId="historique" eventCount={4} pieceCount={2}>
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    expect(screen.getByRole("tab", { name: "Historique (4)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Pièces (2)" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("navigue vers l'onglet sélectionné en mettant à jour ?tab au clic", () => {
    render(
      <CaseFileTabNav selectedTabId="pieces" eventCount={4} pieceCount={2}>
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Historique (4)" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("?tab=historique", { scroll: false });
  });

  it("conserve les autres paramètres d'URL au changement d'onglet", () => {
    setSearchParams("pcSort=nom&hiq=audience&debug=1");

    render(
      <CaseFileTabNav selectedTabId="pieces" eventCount={4} pieceCount={2} showDebugTab>
        <p>Contenu</p>
      </CaseFileTabNav>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Debug" }));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("tab=debug");
    expect(pushedUrl).toContain("pcSort=nom");
    expect(pushedUrl).toContain("hiq=audience");
    expect(pushedUrl).toContain("debug=1");
    expect(mockPush).toHaveBeenCalledWith(expect.any(String), { scroll: false });
  });
});
