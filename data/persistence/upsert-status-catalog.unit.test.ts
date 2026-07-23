import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { upsertStatusCatalog } from "./upsert-status-catalog";
import type { StatusGroup } from "../telerecours/types";

describe("upsertStatusCatalog", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("upserts one row per status id with the group metadata", async () => {
    const groups: StatusGroup[] = [
      {
        id: 5,
        label: "Inscrit au rôle d'une audience",
        category: "C4",
        statusList: [12, 13],
      },
    ];

    const result = await upsertStatusCatalog(prisma, groups);

    expect(result).toEqual({ upserted: 2, skipped: 0 });
    expect(prisma.status.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.status.upsert).toHaveBeenNthCalledWith(1, {
      where: { id: 12 },
      create: {
        id: 12,
        label: "Inscrit au rôle d'une audience",
        category: "C4",
        groupId: 5,
      },
      update: {
        category: "C4",
        groupId: 5,
      },
    });
  });

  it("does not overwrite labels on update", async () => {
    const groups: StatusGroup[] = [
      {
        id: 3,
        label: "En cours d'instruction",
        category: "C3",
        statusList: [5],
      },
    ];

    await upsertStatusCatalog(prisma, groups);

    expect(prisma.status.upsert.mock.calls[0][0].update).not.toHaveProperty("label");
  });

  it("skips groups missing label or category", async () => {
    const groups: StatusGroup[] = [
      { id: 1, statusList: [10, 11] },
      { id: 2, label: "Terminé", statusList: [20] },
    ];

    const result = await upsertStatusCatalog(prisma, groups);

    expect(result).toEqual({ upserted: 0, skipped: 3 });
    expect(prisma.status.upsert).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("ignores groups with an empty statusList", async () => {
    const groups: StatusGroup[] = [{ id: 9, label: "Terminé", category: "C6", statusList: [] }];

    const result = await upsertStatusCatalog(prisma, groups);

    expect(result).toEqual({ upserted: 0, skipped: 0 });
    expect(prisma.status.upsert).not.toHaveBeenCalled();
  });
});
