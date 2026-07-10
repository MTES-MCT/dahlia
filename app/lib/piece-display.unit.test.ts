import { describe, expect, it } from "vitest";
import {
  pieceDisplayLabel,
  pieceDownloadFileName,
  pieceEditionHref,
} from "@/app/lib/piece-display";

describe("pieceDisplayLabel", () => {
  it("returns dahliaName when set", () => {
    expect(pieceDisplayLabel({ dahliaName: "Pièce 1", fileName: "requete.pdf" })).toBe("Pièce 1");
  });

  it("falls back to fileName when dahliaName is null", () => {
    expect(pieceDisplayLabel({ dahliaName: null, fileName: "requete.pdf" })).toBe("requete.pdf");
  });
});

describe("pieceDownloadFileName", () => {
  it("appends the original extension to the DAHLIA display label", () => {
    expect(
      pieceDownloadFileName({
        dahliaName: "Pièce introductive",
        number: "1",
        fileName: "scan_requete.pdf",
      }),
    ).toBe("1 - Pièce introductive.pdf");
  });

  it("keeps fileName when dahliaName is unset", () => {
    expect(pieceDownloadFileName({ dahliaName: null, fileName: "requete.pdf" })).toBe(
      "requete.pdf",
    );
  });

  it("returns the label unchanged when the original file has no extension", () => {
    expect(
      pieceDownloadFileName({
        dahliaName: "Pièce sans extension",
        fileName: "sans_ext",
      }),
    ).toBe("Pièce sans extension");
  });
});

describe("pieceEditionHref", () => {
  it("builds the edition route with encoded path segments", () => {
    expect(
      pieceEditionHref({
        caseFileNumber: "TA069/2024/001",
        encodedFileId: "abc+123",
      }),
    ).toBe("/case_files/TA069%2F2024%2F001/pieces/abc%2B123");
  });

  it("appends the query string when provided", () => {
    expect(
      pieceEditionHref({
        caseFileNumber: "TA069/2024/001",
        encodedFileId: "abc",
        queryString: "tab=pieces&pcSort=date",
      }),
    ).toBe("/case_files/TA069%2F2024%2F001/pieces/abc?tab=pieces&pcSort=date");
  });
});
