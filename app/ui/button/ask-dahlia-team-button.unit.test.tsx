import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AskDahliaTeamButton, ASK_DAHLIA_TEAM_FORM_URL } from "./ask-dahlia-team-button";

describe("AskDahliaTeamButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("ouvre le formulaire Grist dans un nouvel onglet", () => {
    render(<AskDahliaTeamButton />);

    const link = screen.getByRole("link", {
      name: /Demander à l'équipe DAHLIA \(nouvelle fenêtre\)/,
    });
    expect(link.getAttribute("href")).toBe(ASK_DAHLIA_TEAM_FORM_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("applique les classes DSFR du bouton avec icône remix", () => {
    render(<AskDahliaTeamButton />);

    const link = screen.getByRole("link");
    expect(link.className).toContain("fr-btn");
    expect(link.className).toContain("ri-question-line");
    expect(link.className).toContain("fr-btn--icon-left");
    expect(link.className).toContain("fixed");
  });
});
