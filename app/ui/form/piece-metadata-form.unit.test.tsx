import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PieceMetadataForm } from "./piece-metadata-form";

vi.mock("@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions", () => ({
  updatePieceMetadataFormAction: vi.fn(),
}));

describe("PieceMetadataForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("pré-remplit les champs avec les métadonnées existantes", () => {
    const { container } = render(
      <PieceMetadataForm
        encodedFileId="ENC-123"
        dahliaName="Requête introductive"
        number="002"
        comment="À vérifier"
      />,
    );

    const value = (selector: string) =>
      (container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement).value;

    expect(value('input[name="dahliaName"]')).toBe("Requête introductive");
    expect(value('input[name="number"]')).toBe("002");
    expect(value('textarea[name="comment"]')).toBe("À vérifier");
  });

  it("expose l'identifiant de pièce dans un champ caché", () => {
    const { container } = render(
      <PieceMetadataForm encodedFileId="ENC-123" dahliaName="" number="" comment="" />,
    );

    const hidden = container.querySelector('input[name="encodedFileId"]') as HTMLInputElement;
    expect(hidden.value).toBe("ENC-123");
  });

  it("affiche le bouton d'enregistrement", () => {
    render(<PieceMetadataForm encodedFileId="ENC-123" dahliaName="" number="" comment="" />);

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
  });
});
