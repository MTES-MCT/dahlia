import { unzipSync } from "fflate";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/data/attached-files", () => ({
  fetchAttachedFile: vi.fn(),
}));

vi.mock("@/app/lib/data/piece-content", () => ({
  fetchPieceContent: vi.fn(),
}));

import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { fetchPieceContent } from "@/app/lib/data/piece-content";
import { GET, uniqueName } from "./route";

const mockedFetchAttachedFile = vi.mocked(fetchAttachedFile);
const mockedFetchPieceContent = vi.mocked(fetchPieceContent);

const CASE_FILE_NUMBER = "TA069/2024/001";
const ENCODED_CASE_FILE_NUMBER = encodeURIComponent(CASE_FILE_NUMBER);

function downloadRequest(encodedFileIds: string[]) {
  const params = new URLSearchParams();
  for (const id of encodedFileIds) {
    params.append("id", id);
  }
  return new Request(
    `https://dahlia.example/case_files/${ENCODED_CASE_FILE_NUMBER}/pieces/download?${params}`,
  );
}

function routeContext(caseFileNumber = ENCODED_CASE_FILE_NUMBER) {
  return { params: Promise.resolve({ caseFileNumber }) };
}

function attachedFile(encodedFileId: string, caseFileNumber = CASE_FILE_NUMBER) {
  return {
    encodedFileId,
    caseFileNumber,
    fileName: `${encodedFileId}.pdf`,
  };
}

function pieceContent(downloadName: string, byte = 0x41) {
  return {
    data: new Uint8Array([byte]),
    mimeType: "application/pdf",
    downloadName,
  };
}

async function zipEntries(response: Response): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await response.arrayBuffer()));
}

describe("uniqueName", () => {
  it("returns the name unchanged when it is not already used", () => {
    const used = new Set<string>();

    expect(uniqueName("requete.pdf", used)).toBe("requete.pdf");
    expect(used).toEqual(new Set(["requete.pdf"]));
  });

  it("appends (2) before the extension on the first duplicate", () => {
    const used = new Set(["requete.pdf"]);

    expect(uniqueName("requete.pdf", used)).toBe("requete (1).pdf");
    expect(used).toEqual(new Set(["requete.pdf", "requete (1).pdf"]));
  });

  it("increments the suffix until an unused name is found", () => {
    const used = new Set(["doc.pdf", "doc (1).pdf", "doc (2).pdf"]);

    expect(uniqueName("doc.pdf", used)).toBe("doc (3).pdf");
    expect(used.has("doc (3).pdf")).toBe(true);
  });

  it("handles names without an extension", () => {
    const used = new Set(["README"]);

    expect(uniqueName("README", used)).toBe("README (1)");
  });

  it("treats a leading dot as part of the base name, not an extension", () => {
    const used = new Set([".gitignore"]);

    expect(uniqueName(".gitignore", used)).toBe(".gitignore (1)");
  });

  it("uses the last dot as the extension separator", () => {
    const used = new Set(["archive.tar.gz"]);

    expect(uniqueName("archive.tar.gz", used)).toBe("archive (1).tar.gz");
  });
});

describe("GET /case_files/[caseFileNumber]/pieces/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 when no piece id is provided", async () => {
    const response = await GET(downloadRequest([]), routeContext());

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Aucune pièce sélectionnée");
    expect(mockedFetchAttachedFile).not.toHaveBeenCalled();
  });

  it("returns 404 when the attached file is unknown", async () => {
    mockedFetchAttachedFile.mockResolvedValue(null);

    const response = await GET(downloadRequest(["missing-id"]), routeContext());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Pièce introuvable : missing-id");
    expect(mockedFetchPieceContent).not.toHaveBeenCalled();
  });

  it("returns 404 when the attached file belongs to another case file", async () => {
    mockedFetchAttachedFile.mockResolvedValue(attachedFile("file-1", "TA069/2024/999") as never);

    const response = await GET(downloadRequest(["file-1"]), routeContext());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Pièce introuvable : file-1");
    expect(mockedFetchPieceContent).not.toHaveBeenCalled();
  });

  it("returns a zip archive with the expected headers and entry names", async () => {
    const file = attachedFile("file-1") as never;
    mockedFetchAttachedFile.mockResolvedValue(file);
    mockedFetchPieceContent.mockResolvedValue(pieceContent("requete.pdf", 0x51));

    const response = await GET(downloadRequest(["file-1"]), routeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="pieces-TA069/2024/001-2026-07-13.zip"; filename*=UTF-8\'\'pieces-TA069%2F2024%2F001-2026-07-13.zip',
    );

    expect(mockedFetchAttachedFile).toHaveBeenCalledWith("file-1");
    expect(mockedFetchPieceContent).toHaveBeenCalledWith(file);

    const entries = await zipEntries(response);
    expect(Object.keys(entries)).toEqual(["requete.pdf"]);
    expect(Array.from(entries["requete.pdf"]!)).toEqual([0x51]);
  });

  it("deduplicates entry names inside the zip when download names collide", async () => {
    mockedFetchAttachedFile
      .mockResolvedValueOnce(attachedFile("file-1") as never)
      .mockResolvedValueOnce(attachedFile("file-2") as never);
    mockedFetchPieceContent
      .mockResolvedValueOnce(pieceContent("requete.pdf", 0x01))
      .mockResolvedValueOnce(pieceContent("requete.pdf", 0x02));

    const response = await GET(downloadRequest(["file-1", "file-2"]), routeContext());

    expect(response.status).toBe(200);

    const entries = await zipEntries(response);
    expect(Object.keys(entries).sort()).toEqual(["requete (1).pdf", "requete.pdf"]);
    expect(Array.from(entries["requete.pdf"]!)).toEqual([0x01]);
    expect(Array.from(entries["requete (1).pdf"]!)).toEqual([0x02]);
  });

  it("returns 502 when fetching piece content fails", async () => {
    mockedFetchAttachedFile.mockResolvedValue(attachedFile("file-1") as never);
    mockedFetchPieceContent.mockRejectedValue(new Error("Télérecours indisponible"));

    const response = await GET(downloadRequest(["file-1"]), routeContext());

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(
      "Échec du téléchargement des pièces : Error: Télérecours indisponible",
    );
  });
});
