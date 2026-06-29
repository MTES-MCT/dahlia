import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderPieceNameCell, renderPieceTypeCell } from "./case-file-tabs";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

type Piece = NonNullable<CaseFileDetail>["attachedFiles"][number];

function renderCell(node: React.ReactNode) {
  return render(<>{node}</>);
}

const basePiece = {
  encodedFileId: "f1",
  originalFileName: "requete.pdf",
  fileTypeLabel: "Requête",
  eventCreationDate: new Date("2026-01-15T10:00:00"),
} as Piece;

describe("renderPieceNameCell", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le nom original seul quand dahliaName est absent", () => {
    renderCell(renderPieceNameCell(basePiece, () => "/pieces/f1"));

    const link = screen.getByRole("link", { name: "requete.pdf" });
    expect(link.getAttribute("href")).toBe("/pieces/f1");
    expect(screen.getAllByText("requete.pdf")).toHaveLength(1);
  });

  it("affiche dahliaName en lien et le nom original en sous-texte", () => {
    const piece = { ...basePiece, dahliaName: "Requête initiale" } as Piece;

    renderCell(renderPieceNameCell(piece, () => "/pieces/f1"));

    const link = screen.getByRole("link", { name: "Requête initiale" });
    expect(link.getAttribute("href")).toBe("/pieces/f1");
    expect(screen.getByText("requete.pdf")).toBeTruthy();
  });

  it("utilise pieceHref pour construire l'URL du lien", () => {
    const pieceHref = vi.fn(() => "/custom/href");

    renderCell(renderPieceNameCell(basePiece, pieceHref));

    expect(pieceHref).toHaveBeenCalledWith(basePiece);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/custom/href");
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
