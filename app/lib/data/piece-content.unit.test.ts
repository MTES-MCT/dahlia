import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readMockedPdfMock, downloadFileMock } = vi.hoisted(() => ({
  readMockedPdfMock: vi.fn(),
  downloadFileMock: vi.fn(),
}));

vi.mock("@/app/lib/mocked-pieces", () => ({
  readMockedPdf: readMockedPdfMock,
}));

vi.mock("@/app/lib/telerecours", () => ({
  getTelerecoursClient: vi.fn(() => ({
    client: { downloadFile: downloadFileMock },
    jurisdiction: "TA069",
  })),
}));

import { fetchPieceContent } from "./piece-content";
import { getTelerecoursClient } from "@/app/lib/telerecours";

const mockedGetTelerecoursClient = vi.mocked(getTelerecoursClient);

function attachedFile(
  overrides: {
    encodedFileId?: string;
    fileTypeLabel?: string | null;
    mimeType?: string | null;
    dahliaName?: string | null;
    fileName?: string;
    number?: string | null;
  } = {},
) {
  return {
    encodedFileId: "file-abc",
    fileTypeLabel: "Requête",
    mimeType: "application/pdf",
    dahliaName: null,
    fileName: "requete.pdf",
    number: null,
    ...overrides,
  } as never;
}

describe("fetchPieceContent", () => {
  const originalEnvironment = process.env.ENVIRONMENT;
  const originalNoFakeFile = process.env.NO_FAKE_FILE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENVIRONMENT;
    delete process.env.NO_FAKE_FILE;
  });

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.ENVIRONMENT;
    } else {
      process.env.ENVIRONMENT = originalEnvironment;
    }
    if (originalNoFakeFile === undefined) {
      delete process.env.NO_FAKE_FILE;
    } else {
      process.env.NO_FAKE_FILE = originalNoFakeFile;
    }
  });

  describe("outside production", () => {
    it("serves a mocked PDF with application/pdf mime type", async () => {
      const source = Buffer.from("%PDF-1.4 mocked");
      readMockedPdfMock.mockResolvedValue({ data: source, fileName: "Requete.pdf" });

      const file = attachedFile();
      const result = await fetchPieceContent(file);

      expect(readMockedPdfMock).toHaveBeenCalledWith("Requête");
      expect(mockedGetTelerecoursClient).not.toHaveBeenCalled();
      expect(result.mimeType).toBe("application/pdf");
      expect(result.downloadName).toBe("requete.pdf");
      expect(Array.from(result.data)).toEqual(Array.from(source));
    });

    it("copies mocked PDF bytes into a fresh Uint8Array", async () => {
      const source = Buffer.from("%PDF-1.4 mocked");
      readMockedPdfMock.mockResolvedValue({ data: source, fileName: "Requete.pdf" });

      const result = await fetchPieceContent(attachedFile());
      source[0] = 0xff;

      expect(result.data[0]).toBe("%".charCodeAt(0));
    });

    it("derives downloadName from the attached file metadata", async () => {
      readMockedPdfMock.mockResolvedValue({
        data: Buffer.from("pdf"),
        fileName: "Requete.pdf",
      });

      const result = await fetchPieceContent(
        attachedFile({
          dahliaName: "Pièce introductive",
          number: "1",
          fileName: "scan_requete.pdf",
        }),
      );

      expect(result.downloadName).toBe("1 - Pièce introductive.pdf");
    });
  });

  describe("production or NO_FAKE_FILE", () => {
    beforeEach(() => {
      process.env.ENVIRONMENT = "production";
    });

    it("downloads from Télérecours with the encoded file id and jurisdiction", async () => {
      const bytes = new Uint8Array([0x01, 0x02]);
      downloadFileMock.mockResolvedValue({ data: bytes, mimeType: "image/png" });

      const file = attachedFile({ encodedFileId: "enc-123" });
      const result = await fetchPieceContent(file);

      expect(mockedGetTelerecoursClient).toHaveBeenCalled();
      expect(downloadFileMock).toHaveBeenCalledWith("enc-123", "TA069");
      expect(readMockedPdfMock).not.toHaveBeenCalled();
      expect(result.mimeType).toBe("image/png");
      expect(Array.from(result.data)).toEqual([0x01, 0x02]);
      expect(result.downloadName).toBe("requete.pdf");
    });

    it("falls back to file.mimeType when the client omits mimeType", async () => {
      downloadFileMock.mockResolvedValue({
        data: new Uint8Array([0x01]),
        mimeType: null,
      });

      const result = await fetchPieceContent(attachedFile({ mimeType: "application/msword" }));

      expect(result.mimeType).toBe("application/msword");
    });

    it("falls back to application/octet-stream when mimeType is missing everywhere", async () => {
      downloadFileMock.mockResolvedValue({
        data: new Uint8Array([0x01]),
        mimeType: null,
      });

      const result = await fetchPieceContent(attachedFile({ mimeType: null }));

      expect(result.mimeType).toBe("application/octet-stream");
    });

    it("uses Télérecours when NO_FAKE_FILE is true even outside production", async () => {
      delete process.env.ENVIRONMENT;
      process.env.NO_FAKE_FILE = "true";
      downloadFileMock.mockResolvedValue({
        data: new Uint8Array([0x01]),
        mimeType: "application/pdf",
      });

      await fetchPieceContent(attachedFile());

      expect(readMockedPdfMock).not.toHaveBeenCalled();
      expect(downloadFileMock).toHaveBeenCalledWith("file-abc", "TA069");
    });
  });
});
