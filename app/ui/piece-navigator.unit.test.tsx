import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PieceNavigator, type PieceOption } from "./piece-navigator";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const pieces: PieceOption[] = [
  { encodedFileId: "ENC-A", label: "Pièce A", href: "/pieces/ENC-A" },
  { encodedFileId: "ENC-B", label: "Pièce B", href: "/pieces/ENC-B" },
  { encodedFileId: "ENC-C", label: "Pièce C", href: "/pieces/ENC-C" },
];

describe("PieceNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche la position courante et liste toutes les pièces", () => {
    render(<PieceNavigator pieces={pieces} currentEncodedFileId="ENC-B" />);

    expect(screen.getByLabelText("Pièce 2 / 3")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pièce A" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pièce C" })).toBeTruthy();
  });

  it("désactive « précédent » sur la première pièce", () => {
    render(<PieceNavigator pieces={pieces} currentEncodedFileId="ENC-A" />);

    expect(screen.getByRole("button", { name: "Pièce précédente" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Pièce suivante" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("désactive « suivant » sur la dernière pièce", () => {
    render(<PieceNavigator pieces={pieces} currentEncodedFileId="ENC-C" />);

    expect(screen.getByRole("button", { name: "Pièce suivante" })).toHaveProperty("disabled", true);
  });

  it("navigue vers la pièce suivante au clic sur la flèche", () => {
    render(<PieceNavigator pieces={pieces} currentEncodedFileId="ENC-B" />);

    fireEvent.click(screen.getByRole("button", { name: "Pièce suivante" }));

    expect(mockPush).toHaveBeenCalledWith("/pieces/ENC-C", { scroll: false });
  });

  it("navigue vers la pièce choisie dans le select", () => {
    render(<PieceNavigator pieces={pieces} currentEncodedFileId="ENC-B" />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ENC-A" } });

    expect(mockPush).toHaveBeenCalledWith("/pieces/ENC-A", { scroll: false });
  });
});
