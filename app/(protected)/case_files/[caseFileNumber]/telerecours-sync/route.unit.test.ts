import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshCaseFile } from "@/app/(protected)/case_files/[caseFileNumber]/actions";
import { POST } from "./route";

vi.mock("@/app/(protected)/case_files/[caseFileNumber]/actions", () => ({
  refreshCaseFile: vi.fn(),
}));

const mockedRefreshCaseFile = vi.mocked(refreshCaseFile);

const CASE_FILE_NUMBER = "TA069/2024/001";
const ENCODED_CASE_FILE_NUMBER = encodeURIComponent(CASE_FILE_NUMBER);

function routeContext(caseFileNumber = ENCODED_CASE_FILE_NUMBER) {
  return { params: Promise.resolve({ caseFileNumber }) };
}

function syncRequest() {
  return new Request(
    `https://dahlia.example/case_files/${ENCODED_CASE_FILE_NUMBER}/telerecours-sync`,
    {
      method: "POST",
    },
  );
}

describe("POST /case_files/[caseFileNumber]/telerecours-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("relance l'enrichissement Télérecours et renvoie le résultat", async () => {
    mockedRefreshCaseFile.mockResolvedValue({ ok: true });

    const response = await POST(syncRequest(), routeContext());

    expect(mockedRefreshCaseFile).toHaveBeenCalledWith(CASE_FILE_NUMBER);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("transmet l'erreur renvoyée par l'enrichissement", async () => {
    mockedRefreshCaseFile.mockResolvedValue({ ok: false, error: "Timeout Télérecours" });

    const response = await POST(syncRequest(), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Timeout Télérecours",
    });
  });
});
