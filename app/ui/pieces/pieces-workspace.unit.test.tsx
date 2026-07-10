import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { PiecesWorkspace, type WorkspacePiece } from "./pieces-workspace";
import { savePieceMetadataAction } from "@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions";

vi.mock("@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions", () => ({
  savePieceMetadataAction: vi.fn(),
}));

const pieces: WorkspacePiece[] = [
  {
    encodedFileId: "f1",
    number: "001",
    fileName: "requete.pdf",
    dahliaName: "Requête introductive",
    comment: "À vérifier",
    typeLabel: "Requête",
    dataUrl: "/data/f1",
    viewerMimeType: "application/pdf",
  },
  {
    encodedFileId: "f2",
    number: null,
    fileName: "annexe.pdf",
    dahliaName: null,
    comment: null,
    typeLabel: "Mémoire",
    dataUrl: "/data/f2",
    viewerMimeType: "application/pdf",
  },
];

function renderWorkspace() {
  return render(<PiecesWorkspace caseFileNumber="TA069-2026-001" pieces={pieces} />);
}

function sidebar() {
  return screen.getByRole("navigation", { name: "Liste des pièces" });
}

describe("PiecesWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("liste toutes les pièces avec le libellé DAHLIA ou le nom original", () => {
    renderWorkspace();
    const nav = sidebar();
    expect(within(nav).getByText("001 - Requête introductive")).toBeTruthy();
    expect(within(nav).getByText("annexe.pdf")).toBeTruthy();
  });

  it("affiche la première pièce dans le panneau de détail par défaut", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
    expect(screen.getByText("À vérifier")).toBeTruthy();
  });

  it("sélectionne uniquement la pièce cliquée et l'affiche à droite", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /annexe\.pdf/ }));

    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();

    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // "Tout sélectionner" + une case par pièce.
    const checked = boxes.filter((box) => box.checked);
    expect(checked).toHaveLength(1);
  });

  it("coche/décoche toutes les pièces via la case « Tout sélectionner »", () => {
    renderWorkspace();
    const selectAll = screen.getByLabelText("Tout sélectionner") as HTMLInputElement;

    fireEvent.click(selectAll);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((box) => box.checked)).toBe(true);
  });

  it("passe en mode édition puis enregistre les métadonnées", async () => {
    vi.mocked(savePieceMetadataAction).mockResolvedValue({ ok: true });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Éditer/ }));

    const input = screen.getByLabelText("Nom sur DAHLIA") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nouveau nom" } });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await screen.findByRole("heading", { name: "Nouveau nom" });
    expect(savePieceMetadataAction).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ dahliaName: "Nouveau nom" }),
    );
  });
});
