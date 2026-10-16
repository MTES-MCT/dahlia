import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { CaseFileCommentsPanel, type PieceCommentView } from "./case-file-comments-panel";

vi.mock("@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions", () => ({
  updateCaseFileCommentFormAction: vi.fn(async () => ({ ok: true })),
}));

const PIECE_COMMENTS: PieceCommentView[] = [
  {
    encodedFileId: "f1",
    name: "Mémoire en défense",
    comment: "Pièce à contester",
    href: "/case_files/TA069/2600001?tab=pieces&piece=f1",
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof CaseFileCommentsPanel>> = {}) {
  render(
    <CaseFileCommentsPanel
      jurisdictionCode="TA069"
      caseFileNumber="2600001"
      comment="Dossier suivi"
      pieceComments={PIECE_COMMENTS}
      {...overrides}
    />,
  );
}

function commentField() {
  return screen.getByRole("textbox", { name: "Commentaire général" }) as HTMLTextAreaElement;
}

describe("CaseFileCommentsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche les commentaires des pièces avec un lien vers la pièce", () => {
    renderPanel();

    const card = within(
      screen.getByText("Commentaire sur « Mémoire en défense »").closest("li") as HTMLElement,
    );
    expect(card.getByText("Pièce à contester")).toBeTruthy();
    expect(card.getByRole("link", { name: "Voir la pièce" }).getAttribute("href")).toBe(
      "/case_files/TA069/2600001?tab=pieces&piece=f1",
    );
  });

  it("masque la section des commentaires de pièces quand il n'y en a pas", () => {
    renderPanel({ pieceComments: [] });

    expect(screen.queryByText("Commentaires des pièces")).toBeNull();
  });

  it("pré-remplit le commentaire général et désactive les boutons tant que rien n'a changé", () => {
    renderPanel();

    expect(commentField().value).toBe("Dossier suivi");
    expect(
      (screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Annuler" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("signale les modifications non enregistrées et les annule", () => {
    renderPanel();

    fireEvent.change(commentField(), { target: { value: "Nouveau commentaire" } });

    expect(screen.getByRole("status").textContent).toBe("Modifications non enregistrées.");
    const cancel = screen.getByRole("button", { name: "Annuler" }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);

    fireEvent.click(cancel);

    expect(commentField().value).toBe("Dossier suivi");
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
