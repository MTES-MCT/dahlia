"use server";

import { revalidatePath } from "next/cache";
import { LitigationType, RightType, type Prisma } from "@prisma/client";
import type { ProductionDeadlineType } from "@prisma/client";
import { PRODUCTION_DEADLINE_TYPE_VALUES } from "@/app/lib/case-file-enums";
import { prisma } from "@/app/lib/prisma";
import { caseFileHref, caseFileUniqueWhere, type CaseFileKey } from "@/app/lib/case-file-key";
import { CASE_FILE_COMMENT_MAX_LENGTH } from "@/app/lib/case-file-comment";
import { canAccessCaseFile } from "@/app/lib/case-file-scope";
import {
  CLASSIFIER_QUALIFICATION_FIELDS,
  getQualificationReviewState,
} from "@/app/lib/case-file-qualification";
import { HAS_TAGS_FIELD_NAME, TAG_IDS_FIELD_NAME } from "@/app/lib/case-file-tags";
import { clientErrorMessage } from "@/app/lib/client-error";
import { describePrismaError } from "@/app/lib/form-actions";
import { getTelerecoursClientForCaseFile } from "@/app/lib/telerecours";
import { consumeTelerecoursSyncRateLimit } from "@/app/lib/telerecours-sync-rate-limit";
import { enrichCaseFile } from "@/data/persistence/enrich-case-file";

export type RefreshCaseFileResult =
  { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

function isSafeCaseFileKeyPart(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._/-]+$/.test(value)
  );
}

// Re-fetch a single case file from Télérecours and upsert it into the database,
// reusing the same enrichment pipeline as the scraping script. The Télérecours
// client is a singleton per jurisdiction (see getTelerecoursCaseFileClient).
export async function refreshCaseFile(key: CaseFileKey): Promise<RefreshCaseFileResult> {
  // The case file key comes from the client: check its shape, then re-check it
  // against the caller's permission scope before hitting Télérecours and
  // writing to the database.
  if (
    !isSafeCaseFileKeyPart(key?.jurisdictionCode) ||
    !isSafeCaseFileKeyPart(key?.caseFileNumber) ||
    !(await canAccessCaseFile(key))
  ) {
    return { ok: false, error: "Dossier introuvable." };
  }

  // Per-user budget, shared by this route and the refresh button. A refusal
  // here does not call Télérecours and does not write the case file.
  const rateLimit = await consumeTelerecoursSyncRateLimit(key);
  if (!rateLimit.allowed) {
    return rateLimit.limited
      ? { ok: false, error: rateLimit.error, retryAfterSeconds: rateLimit.retryAfterSeconds }
      : { ok: false, error: rateLimit.error };
  }

  try {
    // Credentials follow the case file's own jurisdiction (e.g. TA034 vs TA069).
    const { client, jurisdiction } = await getTelerecoursClientForCaseFile(key);

    // Anonymize everywhere except in production, mirroring the scraping script.
    const anonymize = process.env.ENVIRONMENT !== "production";

    await enrichCaseFile(prisma, client, key.caseFileNumber, jurisdiction, anonymize);

    revalidatePath(caseFileHref(key));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: clientErrorMessage(error, "Échec de la synchronisation") };
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

// yyyy-mm-dd from a date input, as a UTC midnight. Empty means null.
function parseDateInput(raw: string): Date | null | "invalid" {
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

type ClassificationFieldsData = Pick<
  Prisma.CaseFileUpdateInput,
  | "litigationType"
  | "rightType"
  | "productionDeadlineType"
  | "productionDeadlineDate"
  | "caseFileTags"
>;

type ParsedForm<T> = { ok: true; key: CaseFileKey; data: T } | { ok: false; error: string };

// Case file key, then permission scope. Shared by every form of the case-file page.
async function parseAccessibleCaseFileKey(
  formData: FormData,
): Promise<{ ok: true; key: CaseFileKey } | { ok: false; error: string }> {
  const key: CaseFileKey = {
    jurisdictionCode: String(formData.get("jurisdictionCode") ?? "").trim(),
    caseFileNumber: String(formData.get("caseFileNumber") ?? "").trim(),
  };
  if (!key.jurisdictionCode || !key.caseFileNumber) {
    return { ok: false, error: "Numéro de dossier manquant." };
  }

  // Same wording as an unknown case file, so the answer does not reveal that a
  // case file outside the caller's permission scope exists.
  if (!(await canAccessCaseFile(key))) {
    return { ok: false, error: "Dossier introuvable." };
  }
  return { ok: true, key };
}

// User-managed classification fields (type de contentieux, type de droit, tags,
// échéance à produire). Optional field groups are only written when rendered.
async function parseClassificationFields(
  formData: FormData,
): Promise<{ ok: true; data: ClassificationFieldsData } | { ok: false; error: string }> {
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
      const parsedDate = parseDateInput(rawProductionDeadlineDate);
      if (parsedDate === "invalid") {
        return { ok: false, error: "Date limite de production invalide." };
      }
      if (!parsedDate) {
        return { ok: false, error: "Date limite de production requise." };
      }
      productionDeadlineDate = parsedDate;
    }
  }

  return {
    ok: true,
    data: {
      litigationType: litigation.value,
      rightType: right.value,
      ...(hasProductionDeadlineFields ? { productionDeadlineType, productionDeadlineDate } : {}),
      // Full replacement of the tag set, in a single transaction.
      ...(hasTagsField
        ? { caseFileTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
        : {}),
    },
  };
}

async function parseCaseFileForm<T>(
  formData: FormData,
  parseFields: (
    formData: FormData,
  ) => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<ParsedForm<T>> {
  const keyResult = await parseAccessibleCaseFileKey(formData);
  if (!keyResult.ok) return keyResult;
  const fields = await parseFields(formData);
  if (!fields.ok) return fields;
  return { ok: true, key: keyResult.key, data: fields.data };
}

async function saveCaseFile(
  key: CaseFileKey,
  data: Prisma.CaseFileUpdateInput,
): Promise<UpdateCaseFileDetailsResult> {
  try {
    await prisma.caseFile.update({ where: caseFileUniqueWhere(key), data });

    revalidatePath(caseFileHref(key));
    // Tags are displayed in the dashboard rows too, so the list must refresh.
    revalidatePath("/case_files");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describePrismaError(error) };
  }
}

const COM_DALO_NUMBER_MAX_LENGTH = 64;

// Classification fields plus the qualification-only ones (ComDalo, COMED).
async function parseQualificationFields(
  formData: FormData,
): Promise<{ ok: true; data: Prisma.CaseFileUpdateInput } | { ok: false; error: string }> {
  const classification = await parseClassificationFields(formData);
  if (!classification.ok) return classification;

  const comDaloNumber = String(formData.get("comDaloNumber") ?? "").trim();
  if (comDaloNumber.length > COM_DALO_NUMBER_MAX_LENGTH) {
    return { ok: false, error: "Numéro ComDalo trop long." };
  }
  const comedDecisionDate = parseDateInput(String(formData.get("comedDecisionDate") ?? "").trim());
  if (comedDecisionDate === "invalid") {
    return { ok: false, error: "Date de la décision de la COMED invalide." };
  }

  return {
    ok: true,
    data: {
      ...classification.data,
      comDaloNumber: comDaloNumber || null,
      comedDecisionDate,
    },
  };
}

// True when a classifier change is more recent than the last validation, i.e.
// when saving the block is an actual review of automatically proposed values.
async function isQualificationReviewPending(key: CaseFileKey): Promise<boolean> {
  const caseFile = await prisma.caseFile.findUnique({
    where: caseFileUniqueWhere(key),
    select: {
      qualificationValidatedAt: true,
      classificationFieldChanges: {
        where: { field: { in: CLASSIFIER_QUALIFICATION_FIELDS } },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { changedAt: true },
      },
    },
  });
  if (!caseFile) return false;
  return (
    getQualificationReviewState(
      caseFile.qualificationValidatedAt,
      caseFile.classificationFieldChanges[0]?.changedAt ?? null,
    ) === "toReview"
  );
}

// Save the "Qualification du dossier" block. The validation date is only
// stamped when a review was pending, so "Qualification revue et validée le …"
// always refers to an actual review of classifier values.
export async function validateCaseFileQualificationFormAction(
  _prevState: UpdateCaseFileDetailsResult | null,
  formData: FormData,
): Promise<UpdateCaseFileDetailsResult> {
  const parsed = await parseCaseFileForm(formData, parseQualificationFields);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const reviewPending = await isQualificationReviewPending(parsed.key);
  return saveCaseFile(parsed.key, {
    ...parsed.data,
    ...(reviewPending ? { qualificationValidatedAt: new Date() } : {}),
  });
}

async function parseCommentField(
  formData: FormData,
): Promise<{ ok: true; data: Prisma.CaseFileUpdateInput } | { ok: false; error: string }> {
  const comment = String(formData.get("comment") ?? "").trim();
  if (comment.length > CASE_FILE_COMMENT_MAX_LENGTH) {
    return { ok: false, error: "Commentaire trop long." };
  }
  return { ok: true, data: { comment: comment || null } };
}

// Save the general comment of the "Commentaires" block.
export async function updateCaseFileCommentFormAction(
  _prevState: UpdateCaseFileDetailsResult | null,
  formData: FormData,
): Promise<UpdateCaseFileDetailsResult> {
  const parsed = await parseCaseFileForm(formData, parseCommentField);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return saveCaseFile(parsed.key, parsed.data);
}
