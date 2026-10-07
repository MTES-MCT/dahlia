import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/app/lib/case-file-scope", () => ({
  canAccessCaseFile: vi.fn(),
}));

vi.mock("@/app/lib/telerecours", () => ({
  getTelerecoursClientForCaseFile: vi.fn(),
}));

vi.mock("@/data/persistence/enrich-case-file", () => ({
  enrichCaseFile: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { canAccessCaseFile } from "@/app/lib/case-file-scope";
import { getTelerecoursClientForCaseFile } from "@/app/lib/telerecours";
import { revalidatePath } from "next/cache";
import { enrichCaseFile } from "@/data/persistence/enrich-case-file";
import { refreshCaseFile } from "./actions";

const mockedCanAccessCaseFile = vi.mocked(canAccessCaseFile);
const mockedGetTelerecoursClient = vi.mocked(getTelerecoursClientForCaseFile);
const mockedEnrichCaseFile = vi.mocked(enrichCaseFile);

const UPSTREAM = new Error(
  "GET https://administrations.telerecours.fr/api/case-file/1 failed: 502\nBody: upstream-secret",
);

describe("refreshCaseFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCanAccessCaseFile.mockResolvedValue(true);
    mockedGetTelerecoursClient.mockResolvedValue({
      client: {} as never,
      jurisdiction: "TA069",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("masque l'URL Télérecours et le corps amont en dehors du développement", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedEnrichCaseFile.mockRejectedValue(UPSTREAM);

    const result = await refreshCaseFile({
      jurisdictionCode: "TA069",
      caseFileNumber: "TA069/2024/001",
    });

    expect(result).toEqual({ ok: false, error: "Échec de la synchronisation" });
    if (!result.ok) {
      expect(result.error).not.toContain("administrations.telerecours.fr");
      expect(result.error).not.toContain("upstream-secret");
    }
  });

  it("renvoie le diagnostic describeError en développement", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedEnrichCaseFile.mockRejectedValue(UPSTREAM);

    const result = await refreshCaseFile({
      jurisdictionCode: "TA069",
      caseFileNumber: "TA069/2024/001",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Échec de la synchronisation : Error: GET https://administrations.telerecours.fr/api/case-file/1 failed: 502\nBody: upstream-secret",
    });
  });

  it("rafraîchit le dossier du tribunal demandé et revalide son URL", async () => {
    mockedEnrichCaseFile.mockResolvedValue(undefined);
    const key = { jurisdictionCode: "TA034", caseFileNumber: "2401234" };

    expect(await refreshCaseFile(key)).toEqual({ ok: true });

    expect(mockedCanAccessCaseFile).toHaveBeenCalledWith(key);
    expect(mockedGetTelerecoursClient).toHaveBeenCalledWith(key);
    expect(mockedEnrichCaseFile).toHaveBeenCalledWith({}, {}, "2401234", "TA069", true);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/case_files/TA034/2401234");
  });

  it("refuse une clé de dossier mal formée sans interroger la base", async () => {
    const result = await refreshCaseFile({ caseFileNumber: "2401234" } as never);

    expect(result).toEqual({ ok: false, error: "Dossier introuvable." });
    expect(mockedCanAccessCaseFile).not.toHaveBeenCalled();
  });
});
