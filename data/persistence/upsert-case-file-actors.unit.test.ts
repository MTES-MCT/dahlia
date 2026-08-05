import { describe, it, expect, beforeEach, vi } from "vitest";
import { upsertCaseFileActorLink } from "./upsert-case-file-actors";
import { actorFixture } from "../test-support/fixtures";

const mockQualityUpsert = vi.fn();
const mockActorUpsert = vi.fn();
const mockCaseFileActorUpdateMany = vi.fn();
const mockCaseFileActorUpsert = vi.fn();

const prisma = {
  quality: { upsert: (...args: unknown[]) => mockQualityUpsert(...args) },
  actor: { upsert: (...args: unknown[]) => mockActorUpsert(...args) },
  caseFileActor: {
    updateMany: (...args: unknown[]) => mockCaseFileActorUpdateMany(...args),
    upsert: (...args: unknown[]) => mockCaseFileActorUpsert(...args),
  },
} as never;

describe("upsertCaseFileActorLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQualityUpsert.mockResolvedValue({});
    mockActorUpsert.mockResolvedValue({});
    mockCaseFileActorUpdateMany.mockResolvedValue({ count: 0 });
    mockCaseFileActorUpsert.mockResolvedValue({});
  });

  it("retire isMainClaimant des autres acteurs avant d'assigner le nouveau main", async () => {
    const actor = actorFixture({ id: 1275635 });

    await upsertCaseFileActorLink(
      prisma,
      "2506122",
      actor,
      { isMainClaimant: true, isMainDefender: false },
      false,
    );

    expect(mockCaseFileActorUpdateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        caseFileNumber: "2506122",
        isMainClaimant: true,
        actorId: { not: 1275635 },
      },
      data: { isMainClaimant: false },
    });
    expect(mockCaseFileActorUpsert).toHaveBeenCalled();
  });

  it("retire isMainDefender des autres acteurs avant d'assigner le nouveau main", async () => {
    const actor = actorFixture({ id: 1275638 });

    await upsertCaseFileActorLink(
      prisma,
      "2506122",
      actor,
      { isMainClaimant: false, isMainDefender: true },
      false,
    );

    expect(mockCaseFileActorUpdateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        caseFileNumber: "2506122",
        isMainDefender: true,
        actorId: { not: 1275638 },
      },
      data: { isMainDefender: false },
    });
  });

  it("ne touche pas aux flags main quand le lien n'est ni main claimant ni main defender", async () => {
    const actor = actorFixture({ id: 42 });

    await upsertCaseFileActorLink(
      prisma,
      "2506122",
      actor,
      { isMainClaimant: false, isMainDefender: false },
      false,
    );

    expect(mockCaseFileActorUpdateMany).not.toHaveBeenCalled();
    expect(mockCaseFileActorUpsert).toHaveBeenCalled();
  });
});
