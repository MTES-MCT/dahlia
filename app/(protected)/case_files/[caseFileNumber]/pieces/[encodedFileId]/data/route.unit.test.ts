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
      caseFileNumber: encodeURIComponent(CASE_FILE_NUMBER),
      encodedFileId: encodeURIComponent("file-1"),
    }),
  };
}

describe("GET /case_files/[caseFileNumber]/pieces/[encodedFileId]/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 404 when the piece does not belong to the case file", async () => {
    mockedFetchAttachedFile.mockResolvedValue({
      encodedFileId: "file-1",
      caseFileNumber: "TA069/autre",
    } as never);

    const response = await GET(new Request("https://dahlia.example/data"), routeContext());

    expect(response.status).toBe(404);
    expect(mockedFetchPieceContent).not.toHaveBeenCalled();
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
