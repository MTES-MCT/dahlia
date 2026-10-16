import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CaseFileScope } from "@/app/lib/case-file-scope";
import { fetchRelatedCaseFiles } from "./related-case-files";
import { prisma } from "@/app/lib/prisma";
import {
  actorFixture,
  caseFileActorFixture,
} from "@/app/lib/test-support/case-file-actors.fixture";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    relatedCaseFile: {
      findMany: vi.fn(),
    },
  },
}));

const { mockScope } = vi.hoisted(() => ({
  mockScope: vi.fn(async (): Promise<CaseFileScope> => ({
    unrestricted: false,
    jurisdictionIds: [1],
  })),
}));

vi.mock("@/app/lib/case-file-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/case-file-scope")>();
  return {
    isJurisdictionInScope: actual.isJurisdictionInScope,
    getCurrentCaseFileScope: () => mockScope(),
    caseFileScopeWhere: async () => ({ jurisdictionId: { in: [1] } }),
    caseFileRelationScopeWhere: async () => ({ caseFile: { jurisdictionId: { in: [1] } } }),
  };
});

const KEY = { jurisdictionCode: "TA069", caseFileNumber: "2600001" };

function related(
  caseFileNumber: string,
  jurisdictionId: number | null,
  title = "Titre",
  caseFileActors: ReturnType<typeof caseFileActorFixture>[] = [],
) {
  return {
    jurisdictionCode: "TA069",
    caseFileNumber,
    title,
    jurisdictionId,
    litigationType: null,
    rightType: null,
    caseFileActors,
  };
}

describe("fetchRelatedCaseFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockRows(
    outgoing: ReturnType<typeof related>[],
    incoming: ReturnType<typeof related>[],
  ) {
    vi.mocked(prisma.relatedCaseFile.findMany)
      .mockResolvedValueOnce(outgoing.map((relatedCaseFile) => ({ relatedCaseFile })) as never)
      .mockResolvedValueOnce(incoming.map((caseFile) => ({ caseFile })) as never);
  }

  it("scopes both directions of the link on the current case file", async () => {
    mockRows([], []);

    await fetchRelatedCaseFiles(KEY);

    expect(prisma.relatedCaseFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdictionCode: "TA069",
          caseFileNumber: "2600001",
          caseFile: { jurisdictionId: { in: [1] } },
        },
      }),
    );
    expect(prisma.relatedCaseFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdictionCode: "TA069",
          relatedCaseFileNumber: "2600001",
          relatedCaseFile: { jurisdictionId: { in: [1] } },
        },
      }),
    );
  });

  it("merges both directions, deduplicates and sorts by number", async () => {
    mockRows([related("2500030", 1), related("2500010", 1)], [related("2500010", 1)]);

    const result = await fetchRelatedCaseFiles(KEY);

    expect(result.map((link) => link.key.caseFileNumber)).toEqual(["2500010", "2500030"]);
  });

  it("hides the title of case files outside the user's scope", async () => {
    mockRows([related("2500010", 1, "Visible"), related("2500020", 2, "Secret")], []);

    const result = await fetchRelatedCaseFiles(KEY);

    expect(result).toEqual([
      {
        accessible: true,
        key: { jurisdictionCode: "TA069", caseFileNumber: "2500010" },
        title: "Visible",
        displayName: null,
      },
      { accessible: false, key: { jurisdictionCode: "TA069", caseFileNumber: "2500020" } },
    ]);
  });

  it("treats a case file without jurisdiction as inaccessible unless unrestricted", async () => {
    mockRows([related("2500010", null)], []);
    expect((await fetchRelatedCaseFiles(KEY))[0].accessible).toBe(false);

    mockScope.mockResolvedValueOnce({ unrestricted: true, jurisdictionIds: [] });
    mockRows([related("2500010", null)], []);
    expect((await fetchRelatedCaseFiles(KEY))[0].accessible).toBe(true);
  });

  it("builds the display name of accessible case files only", async () => {
    const claimant = [
      caseFileActorFixture({
        actorId: 1,
        isMainClaimant: true,
        isMainDefender: false,
        actor: actorFixture({ id: 1, firstName: "Jean", lastName: "Dupont" }),
      }),
    ];
    mockRows([related("2500010", 1, "T1", claimant), related("2500020", 2, "T2", claimant)], []);

    const [accessible, locked] = await fetchRelatedCaseFiles(KEY);

    expect(accessible).toMatchObject({ accessible: true, displayName: "2500010 - Dupont Jean" });
    expect(locked).toEqual({
      accessible: false,
      key: { jurisdictionCode: "TA069", caseFileNumber: "2500020" },
    });
  });
});
