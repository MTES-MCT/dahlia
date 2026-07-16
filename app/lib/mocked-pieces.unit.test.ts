import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCKED_PDF_FALLBACK, pickMockedPdfFileName, readMockedPdf } from "./mocked-pieces";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));

vi.mock("node:fs/promises", () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}));

afterEach(() => {
  vi.restoreAllMocks();
  readFileMock.mockReset();
});

describe("mocked-pieces", () => {
  describe("pickMockedPdfFileName", () => {
    it("returns the single candidate for a known type", () => {
      expect(pickMockedPdfFileName("Accusé de réception de la requête")).toBe(
        "Accuse_de_reception_de_la_requete.pdf",
      );
    });

    it("trims surrounding whitespace before matching", () => {
      // `Notification décision` is stored with a trailing space in the database.
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(pickMockedPdfFileName("Notification décision ")).toBe("notdeci_1143635358.pdf");
    });

    it("falls back to Autre.pdf for an unknown type", () => {
      expect(pickMockedPdfFileName("Type inconnu")).toBe(MOCKED_PDF_FALLBACK);
    });

    it("falls back to Autre.pdf for null or undefined", () => {
      expect(pickMockedPdfFileName(null)).toBe(MOCKED_PDF_FALLBACK);
      expect(pickMockedPdfFileName(undefined)).toBe(MOCKED_PDF_FALLBACK);
    });

    it("picks the first candidate when Math.random is near 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(pickMockedPdfFileName("Requête")).toBe("1136075500_Requete_TA.pdf");
    });

    it("picks the last candidate when Math.random is near 1", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.999);
      expect(pickMockedPdfFileName("Requête")).toBe("1-Requete_2405328_IIL_1144107799-1-1.pdf");
    });
  });

  describe("readMockedPdf", () => {
    it("reads the chosen file and returns its bytes and name", async () => {
      const bytes = Buffer.from("%PDF-1.4 fake");
      readFileMock.mockResolvedValue(bytes);

      const result = await readMockedPdf("Accusé de réception de la requête");

      expect(result).toEqual({ data: bytes, fileName: "Accuse_de_reception_de_la_requete.pdf" });
      expect(readFileMock).toHaveBeenCalledTimes(1);
      const calledPath = readFileMock.mock.calls[0][0] as string;
      expect(calledPath).toContain("files");
      expect(calledPath).toContain("mocked_pdfs");
      expect(calledPath.endsWith("Accuse_de_reception_de_la_requete.pdf")).toBe(true);
    });

    it("reads Autre.pdf for an unknown type", async () => {
      readFileMock.mockResolvedValue(Buffer.from("fallback"));

      const result = await readMockedPdf("Type inconnu");

      expect(result.fileName).toBe(MOCKED_PDF_FALLBACK);
      expect(readFileMock.mock.calls[0][0] as string).toContain(MOCKED_PDF_FALLBACK);
    });
  });
});
