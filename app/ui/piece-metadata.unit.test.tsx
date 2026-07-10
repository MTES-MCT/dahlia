import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { AttachedFileDetail } from "@/app/lib/data/attached-files";
import { PieceMetadata } from "./piece-metadata";

const baseFile = {
  encodedFileId: "ENC-123",
  fileName: "scan_requete.pdf",
  fileTypeLabel: "Requête",
  fileFamilyType: { label: "Requête introductive" },
  documentType: "REQUETE",
  mimeType: "application/pdf",
  eventCreationDate: new Date("2026-01-15T00:00:00Z"),
} as NonNullable<AttachedFileDetail>;

describe("PieceMetadata", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche les métadonnées de la pièce", () => {
    const { container } = render(<PieceMetadata file={baseFile} />);

    expect(screen.getByRole("heading", { name: "Métadonnées de la pièce" })).toBeTruthy();

    const text = container.textContent ?? "";
    expect(text).toContain("scan_requete.pdf");
    expect(text).toContain("Requête introductive");
    expect(text).toContain("REQUETE");
    expect(text).toContain("application/pdf");
    expect(text).toContain("ENC-123");
    expect(text).toContain("15/01/2026");
  });

  it("affiche un tiret pour les valeurs vides", () => {
    const { container } = render(
      <PieceMetadata file={{ ...baseFile, documentType: "" } as NonNullable<AttachedFileDetail>} />,
    );

    expect(container.textContent).toContain("—");
  });
});
