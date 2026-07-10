import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  renderPieceCommentCell,
  renderPieceNameCell,
  renderPieceTypeCell,
} from "./piece-table-cells";
import type { CaseFilePiece } from "@/app/lib/data/attached-files";

vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

type Piece = CaseFilePiece;

function renderCell(node: React.ReactNode) {
  return render(<>{node}</>);
}

const basePiece = {
  encodedFileId: "f1",
  fileName: "requete.pdf",
  fileTypeLabel: "Requête",
  eventCreationDate: new Date("2026-01-15T10:00:00"),
} as Piece;

describe("renderPieceNameCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le nom original seul quand dahliaName est absent", () => {
    renderCell(renderPieceNameCell(basePiece, "TA069/2024/001", ""));

    const link = screen.getByRole("link", { name: "requete.pdf" });
    expect(link.getAttribute("href")).toBe("/case_files/TA069%2F2024%2F001/pieces/f1");
    expect(screen.getAllByText("requete.pdf")).toHaveLength(1);
  });

  it("affiche dahliaName en lien et le nom original en sous-texte", () => {
    const piece = { ...basePiece, dahliaName: "Requête initiale" } as Piece;

    renderCell(renderPieceNameCell(piece, "TA069/2024/001", ""));

    const link = screen.getByRole("link", { name: "Requête initiale" });
    expect(link.getAttribute("href")).toBe("/case_files/TA069%2F2024%2F001/pieces/f1");
    expect(screen.getByText("requete.pdf")).toBeTruthy();
  });

  it("conserve les paramètres de requête dans l'URL du lien", () => {
    renderCell(renderPieceNameCell(basePiece, "TA069/2024/001", "tab=pieces&pcSort=date"));

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/case_files/TA069%2F2024%2F001/pieces/f1?tab=pieces&pcSort=date",
    );
  });
});

describe("renderPieceCommentCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche un tiret quand le commentaire est absent", () => {
    renderCell(renderPieceCommentCell({ comment: null }));

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("affiche le commentaire tronqué à deux lignes", () => {
    const { container } = renderCell(
      renderPieceCommentCell({ comment: "Commentaire sur plusieurs lignes." }),
    );

    expect(screen.getByText("Commentaire sur plusieurs lignes.")).toBeTruthy();
    expect(container.querySelector(".line-clamp-2")).toBeTruthy();
  });
});

describe("renderPieceTypeCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche uniquement fileTypeLabel quand fileFamilyType est absent", () => {
    renderCell(renderPieceTypeCell(basePiece));

    expect(screen.getByText("Requête")).toBeTruthy();
  });

  it("affiche uniquement fileTypeLabel quand le label famille est identique", () => {
    const piece = {
      ...basePiece,
      fileFamilyType: { code: "REQ", label: "Requête" },
    } as Piece;

    renderCell(renderPieceTypeCell(piece));

    expect(screen.getAllByText("Requête")).toHaveLength(1);
  });

  it("affiche fileTypeLabel et le label famille en sous-texte quand ils diffèrent", () => {
    const piece = {
      ...basePiece,
      fileTypeLabel: "Requête initiale",
      fileFamilyType: { code: "REQ", label: "Requête" },
    } as Piece;

    renderCell(renderPieceTypeCell(piece));

    expect(screen.getByText("Requête initiale")).toBeTruthy();
    expect(screen.getByText("Requête")).toBeTruthy();
  });
});
