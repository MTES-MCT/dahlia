import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CollapsiblePanel } from "./collapsible-panel";

function renderPanel(props: Partial<React.ComponentProps<typeof CollapsiblePanel>> = {}) {
  return render(
    <CollapsiblePanel title="Informations du dossier" {...props}>
      <p>Contenu du panneau</p>
    </CollapsiblePanel>,
  );
}

function getBody() {
  return screen.getByText("Contenu du panneau").parentElement as HTMLElement;
}

describe("CollapsiblePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("expose une région nommée par son titre", () => {
    renderPanel({ hint: "Données issues de Télérecours" });

    expect(screen.getByRole("region", { name: "Informations du dossier" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Informations du dossier" })).toBeTruthy();
    expect(screen.getByText("Données issues de Télérecours")).toBeTruthy();
  });

  it("est replié par défaut et masque son contenu", () => {
    renderPanel();

    const toggle = screen.getByRole("button", { name: "Afficher" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(getBody().id);
    expect(getBody().hidden).toBe(true);
  });

  it("se déplie et se replie au clic", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
    const toggle = screen.getByRole("button", { name: "Replier" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getBody().hidden).toBe(false);

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Afficher" })).toBeTruthy();
    expect(getBody().hidden).toBe(true);
  });

  it("peut être déplié par défaut", () => {
    renderPanel({ defaultOpen: true });

    expect(screen.getByRole("button", { name: "Replier" })).toBeTruthy();
    expect(getBody().hidden).toBe(false);
  });

  it("utilise le libellé d'ouverture fourni", () => {
    renderPanel({ openLabel: "Qualifier" });

    expect(screen.getByRole("button", { name: "Qualifier" })).toBeTruthy();
  });

  it("n'affiche le résumé que lorsqu'il est replié", () => {
    renderPanel({ summary: "Déposé le 19/07/2026" });
    expect(screen.getByText("Déposé le 19/07/2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
    expect(screen.queryByText("Déposé le 19/07/2026")).toBeNull();
  });

  it("affiche le bandeau qu'il soit replié ou déplié", () => {
    renderPanel({ banner: "Dossier clôturé" });
    expect(screen.getByText("Dossier clôturé")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
    expect(screen.getByText("Dossier clôturé")).toBeTruthy();
  });
});
