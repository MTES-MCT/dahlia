import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardStatusFilterOptions } from "./statuses";

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    status: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/app/lib/prisma";

describe("fetchDashboardStatusFilterOptions", () => {
  beforeEach(() => {
    vi.mocked(prisma.status.findMany).mockReset();
  });

  it("returns distinct labels sorted in French locale order", async () => {
    vi.mocked(prisma.status.findMany).mockResolvedValue([
      { label: "Terminé" },
      { label: "En cours d'instruction" },
      { label: "Demande d'exécution" },
    ] as never);

    await expect(fetchDashboardStatusFilterOptions()).resolves.toEqual([
      "Demande d'exécution",
      "En cours d'instruction",
      "Terminé",
    ]);

    expect(prisma.status.findMany).toHaveBeenCalledWith({
      select: { label: true },
      distinct: ["label"],
      orderBy: { label: "asc" },
    });
  });
});
