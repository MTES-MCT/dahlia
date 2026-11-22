import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeaderDahlia } from "./header-dahlia";

// The DSFR Header renders quick-access items twice (desktop + mobile menus),
// so we assert on getAllBy*/queryAllBy* rather than the single-match queries.

describe("HeaderDahlia", () => {
  const originalDocumentationUrl = process.env.DAHLIA_DOCUMENTATION_URL;

  afterEach(() => {
    cleanup();
    if (originalDocumentationUrl === undefined) {
      delete process.env.DAHLIA_DOCUMENTATION_URL;
    } else {
      process.env.DAHLIA_DOCUMENTATION_URL = originalDocumentationUrl;
    }
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

  it("redirige vers l'accueil quand aucun utilisateur n'est fourni", () => {
    render(<HeaderDahlia />);

    const homeLinks = screen.getAllByRole("link", { name: /DAHLIA/ });
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(homeLinks[0].getAttribute("href")).toBe("/");
    expect(homeLinks[0].getAttribute("title")).toBe("Accueil - DAHLIA");
  });

  it("redirige vers le tableau de bord quand un utilisateur est connecté", () => {
    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont" }} />);

    const homeLinks = screen.getAllByRole("link", { name: /DAHLIA/ });
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(homeLinks[0].getAttribute("href")).toBe("/case_files");
    expect(homeLinks[0].getAttribute("title")).toBe("Tableau de bord - DAHLIA");
  });

  it("affiche les prénom et nom de l'utilisateur connecté et « Se déconnecter »", () => {
    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont" }} />);

    expect(screen.getAllByText("Jean Dupont").length).toBeGreaterThan(0);
    const liens = screen.getAllByRole("link", { name: /Se déconnecter/ });
    expect(liens[0].tagName).toBe("A");
    expect(liens[0].getAttribute("href")).toBe("/api/auth/proconnect-logout");
    expect(liens[0].className).toContain("fr-btn");
    expect(liens[0].className).toContain("fr-icon-logout-box-r-line");
    expect(screen.queryAllByText(/Se connecter/)).toHaveLength(0);
    expect(screen.queryAllByRole("link", { name: /Administration/ })).toHaveLength(0);
  });

  it("affiche le lien Administration pour un administrateur", () => {
    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont", isAdmin: true }} />);

    const liens = screen.getAllByRole("link", { name: /Administration/ });
    expect(liens.length).toBeGreaterThan(0);
    expect(liens[0].getAttribute("href")).toBe("/admin");
  });

  it("affiche le lien Documentation quand DAHLIA_DOCUMENTATION_URL est défini", () => {
    process.env.DAHLIA_DOCUMENTATION_URL =
      "https://dahlia-documentation.osc-secnum-fr1.scalingo.io";

    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont" }} />);

    const liens = screen.getAllByRole("link", { name: /Documentation/ });
    expect(liens.length).toBeGreaterThan(0);
    expect(liens[0].getAttribute("href")).toBe(
      "https://dahlia-documentation.osc-secnum-fr1.scalingo.io",
    );
    expect(liens[0].getAttribute("target")).toBe("_blank");
    expect(liens[0].getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("masque le lien Documentation quand DAHLIA_DOCUMENTATION_URL est vide", () => {
    process.env.DAHLIA_DOCUMENTATION_URL = "   ";

    render(<HeaderDahlia user={{ firstName: "Jean", lastName: "Dupont" }} />);

    expect(screen.queryAllByRole("link", { name: /Documentation/ })).toHaveLength(0);
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
