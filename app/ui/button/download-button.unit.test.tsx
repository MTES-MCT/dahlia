import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DownloadButton } from "./download-button";

describe("DownloadButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche un lien de téléchargement avec le libellé par défaut", () => {
    render(<DownloadButton href="/case_files/export?q=test" />);

    const link = screen.getByRole("link", { name: "Télécharger les résultats" });
    expect(link.getAttribute("href")).toBe("/case_files/export?q=test");
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("accepte un libellé personnalisé", () => {
    render(<DownloadButton href="/export">Exporter le CSV</DownloadButton>);

    expect(screen.getByRole("link", { name: "Exporter le CSV" })).toBeTruthy();
  });

  it("applique les classes DSFR du bouton secondaire avec icône", () => {
    render(<DownloadButton href="/export" />);

    const link = screen.getByRole("link");
    expect(link.className).toContain("fr-btn");
    expect(link.className).toContain("fr-btn--secondary");
    expect(link.className).toContain("fr-icon-download-line");
    expect(link.className).toContain("fr-btn--icon-left");
  });
});
