import { vi } from "vitest";
import { TelerecoursClient } from "../telerecours/client.interface";
import { emptyPage } from "./fixtures";

// Build a fake TelerecoursClient for tests. Every method is a vi.fn() returning
// a sensible empty default; pass overrides to make a method return fixtures.
// Typed against the real interface, so a stubbed return that doesn't match the
// DTO shape fails to compile.
export function fakeTelerecoursClient(over: Partial<TelerecoursClient> = {}): TelerecoursClient {
  return {
    getInProgressStatusGroupIds: vi.fn().mockResolvedValue([1, 2]),
    getCaseFiles: vi.fn().mockResolvedValue(emptyPage()),
    getCaseFileDetail: vi.fn().mockRejectedValue(new Error("getCaseFileDetail not stubbed")),
    getCaseFileActors: vi.fn().mockResolvedValue(emptyPage()),
    getCaseFileHearings: vi.fn().mockResolvedValue(emptyPage()),
    getCaseFileMeasures: vi.fn().mockResolvedValue(emptyPage()),
    getCaseFileAttachedFiles: vi.fn().mockResolvedValue(emptyPage()),
    getCaseFileRelatedReport: vi.fn().mockResolvedValue({ accessibleCaseFiles: [] }),
    downloadFile: vi.fn().mockRejectedValue(new Error("downloadFile not stubbed")),
    ...over,
  };
}
