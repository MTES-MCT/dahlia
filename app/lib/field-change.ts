import type { FieldChangeModel, Prisma, PrismaClient } from "@prisma/client";

// Shared by the webapp and the standalone scripts of `data/`: no import of the
// webapp Prisma singleton, the client is always passed in.

// Record targeted by a field change (`field_changes` table). Telerecours ids are
// only unique per court, hence `jurisdictionCode`.
export type FieldChangeTarget = {
  jurisdictionCode: string;
  model: FieldChangeModel;
  modelId: string;
};

export type FieldChangeInput = {
  field: string;
  previousValue: string | null;
  newValue: string;
  // Classification rule id, or "user" | "scraper" | "script".
  origin: string;
  // Defaults to the database clock. Pass it to share one timestamp with the
  // rest of the write (e.g. the pièce's `updatedAt`).
  changedAt?: Date;
};

type FieldChangeDb = Pick<PrismaClient, "fieldChange">;

export function fieldChangeTargetCaseFile(key: {
  jurisdictionCode: string;
  caseFileNumber: string;
}): FieldChangeTarget {
  return { jurisdictionCode: key.jurisdictionCode, model: "CaseFile", modelId: key.caseFileNumber };
}

export function fieldChangeTargetAttachedFile(
  jurisdictionCode: string,
  encodedFileId: string,
): FieldChangeTarget {
  return { jurisdictionCode, model: "AttachedFile", modelId: encodedFileId };
}

export function fieldChangeData(
  target: FieldChangeTarget,
  change: FieldChangeInput,
): Prisma.FieldChangeCreateManyInput {
  return { ...target, ...change };
}

// Returns the Prisma promise unawaited so it can join a batch `$transaction`.
export function recordFieldChange(
  db: FieldChangeDb,
  target: FieldChangeTarget,
  change: FieldChangeInput,
) {
  return db.fieldChange.create({ data: fieldChangeData(target, change) });
}

// Whether `field` of the target was ever changed by `origin`.
export async function hasFieldChangeBy(
  db: FieldChangeDb,
  target: FieldChangeTarget,
  field: string,
  origin: string,
): Promise<boolean> {
  const change = await db.fieldChange.findFirst({
    where: { ...target, field, origin },
    select: { id: true },
  });
  return change !== null;
}
