"use server";

import { revalidatePath } from "next/cache";
import { LitigationType, RightType } from "@prisma/client";
import type { ProductionDeadlineType } from "@prisma/client";
import { PRODUCTION_DEADLINE_TYPE_VALUES } from "@/app/lib/case-file-enums";
import { prisma } from "@/app/lib/prisma";
import { canAccessCaseFile } from "@/app/lib/case-file-scope";
import { HAS_TAGS_FIELD_NAME, TAG_IDS_FIELD_NAME } from "@/app/lib/case-file-tags";
import { describeError } from "@/data/telerecours/http";
import { getTelerecoursClientForCaseFile } from "@/app/lib/telerecours";
import { enrichCaseFile } from "@/data/persistence/enrich-case-file";

export type RefreshCaseFileResult = { ok: true } | { ok: false; error: string };

// Re-fetch a single case file from Télérecours and upsert it into the database,
// reusing the same enrichment pipeline as the scraping script. The Télérecours
// client is a singleton per jurisdiction (see getTelerecoursCaseFileClient).
export async function refreshCaseFile(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  // The case file number comes from the client: re-check it against the caller's
  // permission scope before hitting Télérecours and writing to the database.
  if (!(await canAccessCaseFile(caseFileNumber))) {
    return { ok: false, error: "Dossier introuvable." };
  }

  try {
    // Credentials follow the case file's own jurisdiction (e.g. TA034 vs TA069).
    const { client, jurisdiction } = await getTelerecoursClientForCaseFile(caseFileNumber);

    // Anonymize everywhere except in production, mirroring the scraping script.
    const anonymize = process.env.ENVIRONMENT !== "production";

    await enrichCaseFile(prisma, client, caseFileNumber, jurisdiction, anonymize);

    revalidatePath(`/case_files/${encodeURIComponent(caseFileNumber)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export type UpdateCaseFileDetailsResult = { ok: true } | { ok: false; error: string };

// Resolve a raw form value to an enum member, or null when empty/invalid.
function parseEnumValue<T extends Record<string, string>>(
  enumObject: T,
  raw: string,
): { value: T[keyof T] | null; invalid: boolean } {
  if (!raw) {
    return { value: null, invalid: false };
  }
  if (Object.values(enumObject).includes(raw)) {
    return { value: raw as T[keyof T], invalid: false };
  }
  return { value: null, invalid: true };
}

function parseAllowedValue<T extends string>(
  allowed: readonly T[],
  raw: string,
): { value: T | null; invalid: boolean } {
  if (!raw) {
    return { value: null, invalid: false };
  }
  if (allowed.includes(raw as T)) {
    return { value: raw as T, invalid: false };
  }
  return { value: null, invalid: true };
}

function parseProductionDeadlineDate(raw: string): Date | null | "invalid" {
  if (!raw) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    return "invalid";
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "invalid";
  }
  return date;
}

// Tag ids submitted by the picker as repeated hidden inputs. Duplicates are
// collapsed so the join rows stay unique.
function parseTagIds(formData: FormData): number[] | "invalid" {
  const ids = new Set<number>();

  for (const raw of formData.getAll(TAG_IDS_FIELD_NAME)) {
    const value = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isInteger(value) || value <= 0) {
      return "invalid";
    }
    ids.add(value);
  }

  return [...ids];
}

// Persist the user-managed classification fields of a case file (type de
// contentieux, type de droit, raison/summary, tags) edited from the details card.
export async function updateCaseFileDetailsFormAction(
  _prevState: UpdateCaseFileDetailsResult | null,
  formData: FormData,
): Promise<UpdateCaseFileDetailsResult> {
  const caseFileNumber = String(formData.get("caseFileNumber") ?? "").trim();
  if (!caseFileNumber) {
    return { ok: false, error: "Numéro de dossier manquant." };
  }

  // Same wording as an unknown case file, so the answer does not reveal that a
  // case file outside the caller's permission scope exists.
  if (!(await canAccessCaseFile(caseFileNumber))) {
    return { ok: false, error: "Dossier introuvable." };
  }

  const litigation = parseEnumValue(
    LitigationType,
    String(formData.get("litigationType") ?? "").trim(),
  );
  if (litigation.invalid) {
    return { ok: false, error: "Type de contentieux invalide." };
  }
  const right = parseEnumValue(RightType, String(formData.get("rightType") ?? "").trim());
  if (right.invalid) {
    return { ok: false, error: "Type de droit invalide." };
  }
  const summary = String(formData.get("summary") ?? "").trim();

  const hasTagsField = formData.get(HAS_TAGS_FIELD_NAME) === "true";
  let tagIds: number[] = [];

  if (hasTagsField) {
    const parsedTagIds = parseTagIds(formData);
    if (parsedTagIds === "invalid") {
      return { ok: false, error: "Tag invalide." };
    }
    tagIds = parsedTagIds;

    // The ids travel in hidden inputs, so they are forgeable: check they all
    // exist rather than surfacing a raw foreign-key error.
    if (tagIds.length > 0) {
      const existingCount = await prisma.tag.count({ where: { id: { in: tagIds } } });
      if (existingCount !== tagIds.length) {
        return { ok: false, error: "Tag introuvable." };
      }
    }
  }

  const hasProductionDeadlineFields = formData.get("hasProductionDeadlineFields") === "true";
  let productionDeadlineType: ProductionDeadlineType | null = null;
  let productionDeadlineDate: Date | null = null;

  if (hasProductionDeadlineFields) {
    const deadlineType = parseAllowedValue(
      PRODUCTION_DEADLINE_TYPE_VALUES,
      String(formData.get("productionDeadlineType") ?? "").trim(),
    );
    if (deadlineType.invalid) {
      return { ok: false, error: "Type d'échéance à produire invalide." };
    }
    productionDeadlineType = deadlineType.value;

    if (productionDeadlineType) {
      const rawProductionDeadlineDate = String(formData.get("productionDeadlineDate") ?? "").trim();
      const parsedDate = parseProductionDeadlineDate(rawProductionDeadlineDate);
      if (parsedDate === "invalid") {
        return { ok: false, error: "Date limite de production invalide." };
      }
      if (!parsedDate) {
        return { ok: false, error: "Date limite de production requise." };
      }
      productionDeadlineDate = parsedDate;
    }
  }

  try {
    await prisma.caseFile.update({
      where: { caseFileNumber },
      data: {
        litigationType: litigation.value,
        rightType: right.value,
        summary: summary || null,
        ...(hasProductionDeadlineFields
          ? {
              productionDeadlineType,
              productionDeadlineDate,
            }
          : {}),
        // Full replacement of the tag set, in a single transaction.
        ...(hasTagsField
          ? { caseFileTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
    });

    revalidatePath(`/case_files/${encodeURIComponent(caseFileNumber)}`);
    // Tags are displayed in the dashboard rows too, so the list must refresh.
    revalidatePath("/case_files");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
