import { describe, expect, it } from "vitest";
import {
  comparePiecesByDateDescThenName,
  pieceDisplayLabel,
  pieceDownloadFileName,
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
        fileName: "scan_requete.pdf",
      }),
    ).toBe("Pièce introductive.pdf");
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

describe("comparePiecesByDateDescThenName", () => {
  const piece = (fileName: string, date: string | null, dahliaName: string | null = null) => ({
    fileName,
    dahliaName,
    eventCreationDate: date ? new Date(date) : null,
  });

  it("trie par jour décroissant puis par nom affiché croissant", () => {
    // Same-day pièces: time order (charlie, bravo, Alpha) is ignored in favor of the name.
    const sorted = [
      piece("bravo.pdf", "2026-03-01T10:00:00"),
      piece("z.pdf", "2026-03-02T00:00:00"),
      piece("c.pdf", "2026-03-01T09:00:00", "Alpha"),
      piece("charlie.pdf", "2026-03-01T18:00:00"),
      piece("sans-date.pdf", null),
    ].toSorted(comparePiecesByDateDescThenName);

    expect(sorted.map((p) => p.dahliaName ?? p.fileName)).toEqual([
      "z.pdf",
      "Alpha",
      "bravo.pdf",
      "charlie.pdf",
      "sans-date.pdf",
    ]);
  });

  it("ignore accents et casse, et compare les nombres naturellement", () => {
    const day = "2026-03-01T00:00:00";
    const sorted = [piece("pièce 10", day), piece("Pièce 2", day), piece("piece 1", day)].toSorted(
      comparePiecesByDateDescThenName,
    );
    expect(sorted.map((p) => p.fileName)).toEqual(["piece 1", "Pièce 2", "pièce 10"]);
  });
});
