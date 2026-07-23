import type { PrismaClient } from "@prisma/client";
import type { StatusGroup } from "../telerecours/types";

export type StatusCatalogUpsertResult = {
  upserted: number;
  skipped: number;
};

// Seed the statuses catalogue from Telerecours status groups. Creates missing
// rows with the group label; on existing rows only refreshes category/groupId so
// labels observed on case files stay authoritative.
export async function upsertStatusCatalog(
  prisma: PrismaClient,
  groups: StatusGroup[],
): Promise<StatusCatalogUpsertResult> {
  let upserted = 0;
  let skipped = 0;

  for (const group of groups) {
    const statusIds = group.statusList ?? [];
    if (statusIds.length === 0) {
      continue;
    }

    if (!group.label || !group.category) {
      console.warn(
        `⚠ Skipping status group ${group.id}: missing label or category ` +
          `(${statusIds.length} status id(s)).`,
      );
      skipped += statusIds.length;
      continue;
    }

    for (const statusId of statusIds) {
      await prisma.status.upsert({
        where: { id: statusId },
        create: {
          id: statusId,
          label: group.label,
          category: group.category,
          groupId: group.id,
        },
        update: {
          category: group.category,
          groupId: group.id,
        },
      });
      upserted += 1;
    }
  }

  return { upserted, skipped };
}
