import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaseFileIdentity } from "@/app/ui/case-file/case-file-identity";

const TAGS = [
  { id: 1, label: "Urgent", color: "pink-tuile" },
  { id: 2, label: "À relancer", color: "green-menthe" },
];

describe("CaseFileIdentity", () => {
  afterEach(() => {
    cleanup();
  });

  describe("variante lien (cellule de tableau)", () => {
    it("rend le nom d'affichage en lien", () => {
      render(
        <CaseFileIdentity
          displayName="TA069/12345"
          title="Requête DALO"
          statusLabel="En cours d'instruction"
          tags={[]}
          name={{ kind: "link", href: "/case_files/TA069%2F12345" }}
        />,
      );

      const link = screen.getByRole("link", { name: "TA069/12345" });
      expect(link.getAttribute("href")).toBe("/case_files/TA069%2F12345");
    });

    // A table cell must not carry a level-1 heading: the page owns the only h1.
    it("ne rend aucun titre de niveau 1", () => {
      render(
        <CaseFileIdentity
          displayName="TA069/12345"
          title={null}
          statusLabel="En cours d'instruction"
          tags={[]}
          name={{ kind: "link", href: "/case_files/TA069%2F12345" }}
        />,
      );

      expect(screen.queryByRole("heading")).toBeNull();
    });
  });

  describe("variante titre (fiche dossier)", () => {
    it("rend le nom d'affichage en titre de niveau 1 et affiche le slot d'actions", () => {
      render(
        <CaseFileIdentity
          displayName="TA069/12345"
          title={null}
          statusLabel="En cours d'instruction"
          tags={[]}
          name={{ kind: "heading" }}
          actions={<button type="button">Détails du dossier</button>}
        />,
      );

      const heading = screen.getByRole("heading", { level: 1, name: "TA069/12345" });
      expect(heading.className).toContain("fr-h4");
      expect(screen.getByRole("button", { name: "Détails du dossier" })).toBeTruthy();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  it("affiche le titre Télérecours en italique quand il est renseigné", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title="  Requête DALO  "
        statusLabel="En cours d'instruction"
        tags={[]}
        name={{ kind: "heading" }}
      />,
    );

    const subtitle = screen.getByText("Requête DALO");
    expect(subtitle.className).toContain("italic");
  });

  it("omet le titre quand il est vide ou fait d'espaces", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title="   "
        statusLabel="En cours d'instruction"
        tags={[]}
        name={{ kind: "heading" }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 }).parentElement?.querySelector("p")).toBeNull();
  });

  it("affiche le badge de statut avec son accentuation", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title={null}
        statusLabel="Terminé"
        tags={[]}
        name={{ kind: "heading" }}
      />,
    );

    expect(screen.getByText("Terminé").className).toContain("fr-badge--green-menthe");
  });

  it("affiche les tags sous le statut, en petits badges colorés", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title={null}
        statusLabel="En cours d'instruction"
        tags={TAGS}
        name={{ kind: "heading" }}
      />,
    );

    const tagsGroup = screen.getByRole("list", { name: "Tags du dossier" });
    const urgent = within(tagsGroup).getByText("Urgent");
    // Badges, not DSFR tags: tag accents are only styled on interactive elements.
    expect(urgent.className).toContain("fr-badge");
    expect(urgent.className).toContain("fr-badge--sm");
    expect(urgent.className).toContain("fr-badge--pink-tuile");
    expect(urgent.className).not.toContain("fr-tag");
    expect(within(tagsGroup).getByText("À relancer").className).toContain("fr-badge--green-menthe");

    // The tag list comes after the status badge in the DOM.
    const status = screen.getByText("En cours d'instruction");
    expect(
      status.compareDocumentPosition(tagsGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("ne rend aucune liste quand il n'y a pas de tag", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title={null}
        statusLabel="En cours d'instruction"
        tags={[]}
        name={{ kind: "heading" }}
      />,
    );

    expect(screen.queryByRole("list", { name: "Tags du dossier" })).toBeNull();
  });

  it("retombe sur la couleur par défaut pour une couleur inconnue", () => {
    render(
      <CaseFileIdentity
        displayName="TA069/12345"
        title={null}
        statusLabel="En cours d'instruction"
        tags={[{ id: 3, label: "Inconnu", color: "chartreuse" }]}
        name={{ kind: "heading" }}
      />,
    );

    expect(screen.getByText("Inconnu").className).toContain("fr-badge--blue-ecume");
  });
});
