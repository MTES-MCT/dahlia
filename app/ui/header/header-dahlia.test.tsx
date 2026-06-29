import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeaderDahlia } from "./header-dahlia";

// The DSFR Header renders quick-access items twice (desktop + mobile menus),
// so we assert on getAllBy*/queryAllBy* rather than the single-match queries.

describe("HeaderDahlia", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le titre du service et le badge Beta", () => {
    render(<HeaderDahlia />);

    expect(screen.getByText("Beta")).toBeTruthy();
    expect(
      screen.getByText(
        "Aide au traitement des contentieux du droit au logement et à l'hébergement opposable",
      ),
    ).toBeTruthy();
  });

  it("propose « Se connecter » quand aucun utilisateur n'est fourni", () => {
    render(<HeaderDahlia />);

    const liens = screen.getAllByRole("link", { name: /Se connecter/ });
    expect(liens.length).toBeGreaterThan(0);
    expect(liens[0].getAttribute("href")).toBe("/connexion");
    expect(screen.queryAllByText(/Se déconnecter/)).toHaveLength(0);
  });

  it("affiche les prénom et nom de l'utilisateur connecté et « Se déconnecter »", () => {
    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont" }} />);

    expect(screen.getAllByText("Jean Dupont").length).toBeGreaterThan(0);
    const liens = screen.getAllByRole("link", { name: /Se déconnecter/ });
    expect(liens[0].getAttribute("href")).toBe("/api/auth/proconnect-logout");
    expect(screen.queryAllByText(/Se connecter/)).toHaveLength(0);
  });

  it("se replie sur name quand prénom et nom sont absents", () => {
    render(<HeaderDahlia user={{ name: "jdupont", email: "jean@example.org" }} />);

    expect(screen.getAllByText("jdupont").length).toBeGreaterThan(0);
  });

  it("se replie sur l'email quand seul l'email est disponible", () => {
    render(<HeaderDahlia user={{ email: "jean@example.org" }} />);

    expect(screen.getAllByText("jean@example.org").length).toBeGreaterThan(0);
  });
});
