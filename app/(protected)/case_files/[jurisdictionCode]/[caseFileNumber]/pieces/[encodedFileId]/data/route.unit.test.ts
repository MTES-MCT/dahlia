import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/data/attached-files", () => ({
  fetchAttachedFile: vi.fn(),
}));

vi.mock("@/app/lib/data/piece-content", () => ({
  fetchPieceContent: vi.fn(),
}));

import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { fetchPieceContent } from "@/app/lib/data/piece-content";
import { GET } from "./route";

const mockedFetchAttachedFile = vi.mocked(fetchAttachedFile);
const mockedFetchPieceContent = vi.mocked(fetchPieceContent);

const CASE_FILE_NUMBER = "TA069/2024/001";

function routeContext() {
  return {
    params: Promise.resolve({
      jurisdictionCode: "TA069",
      caseFileNumber: encodeURIComponent(CASE_FILE_NUMBER),
      encodedFileId: encodeURIComponent("file-1"),
    }),
  };
}

describe("GET /case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("streams the piece with a sanitized Content-Disposition filename", async () => {
    mockedFetchAttachedFile.mockResolvedValue({
      encodedFileId: "file-1",
      caseFileNumber: CASE_FILE_NUMBER,
    } as never);
    mockedFetchPieceContent.mockResolvedValue({
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: "application/pdf",
      downloadName: "../../Pièce.pdf",
    });

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      "inline; filename=\".._.._Pi_ce.pdf\"; filename*=UTF-8''.._.._Pi%C3%A8ce.pdf",
    );
  });

  it("looks the piece up within the requested case file and returns 404 when absent", async () => {
    // `fetchAttachedFile` answers null (and records the miss) for a piece of
    // another case file, an unknown piece or an out-of-scope one.
    mockedFetchAttachedFile.mockResolvedValue(null);

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(404);
    expect(mockedFetchAttachedFile).toHaveBeenCalledWith(
      { jurisdictionCode: "TA069", caseFileNumber: CASE_FILE_NUMBER },
      "file-1",
    );
    expect(mockedFetchPieceContent).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the Télérecours budget is spent", async () => {
    const { TelerecoursUserRateLimitedError } = await import(
      "@/app/lib/telerecours-user-rate-limited-error"
    );
    mockedFetchAttachedFile.mockResolvedValue({
      encodedFileId: "file-1",
      caseFileNumber: CASE_FILE_NUMBER,
    } as never);
    mockedFetchPieceContent.mockRejectedValue(
      new TelerecoursUserRateLimitedError("Trop d'appels Télérecours. Réessayez dans une minute.", 42),
    );

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.text()).toBe("Trop d'appels Télérecours. Réessayez dans une minute.");
  });

  it("returns 502 without the upstream diagnostic outside development", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetchAttachedFile.mockResolvedValue({
      encodedFileId: "file-1",
      caseFileNumber: CASE_FILE_NUMBER,
    } as never);
    mockedFetchPieceContent.mockRejectedValue(
      new Error(
        "GET https://administrations.telerecours.fr/api/file-api/1 failed: 502\nBody: upstream-secret",
      ),
    );

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toBe("Échec du téléchargement de la pièce");
    expect(body).not.toContain("administrations.telerecours.fr");
    expect(body).not.toContain("upstream-secret");
  });

  it("returns 502 with the upstream diagnostic in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetchAttachedFile.mockResolvedValue({
      encodedFileId: "file-1",
      caseFileNumber: CASE_FILE_NUMBER,
    } as never);
    mockedFetchPieceContent.mockRejectedValue(new Error("Télérecours indisponible"));

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(
      "Échec du téléchargement de la pièce : Error: Télérecours indisponible",
    );
  });
});
