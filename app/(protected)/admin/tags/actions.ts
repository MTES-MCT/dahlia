"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AdminMutationResult, withAdminAction } from "@/app/lib/admin-actions";
import {
  describePrismaError,
  parsePositiveIntField,
  parseRequiredText,
} from "@/app/lib/form-actions";
import { prisma } from "@/app/lib/prisma";
import { fetchTagCaseFiles, type TagCaseFileRow } from "@/app/lib/data/tags";
import { DEFAULT_TAG_COLOR, isTagColor } from "@/app/lib/tag-colors";

export type TagMutationResult = AdminMutationResult;

export type TagCaseFilesResult =
  { ok: true; caseFiles: TagCaseFileRow[] } | { ok: false; error: string };

const ADMIN_TAGS_PATH = "/admin/tags";
const TAG_LABEL_MAX_LENGTH = 60;

const TAG_PRISMA_ERRORS = {
  P2002: "Un tag porte déjà ce libellé.",
  P2025: "Tag introuvable.",
  P2003: "Ce tag est utilisé par des dossiers et ne peut pas être supprimé.",
};

type ParsedTagFields = { ok: true; label: string; color: string } | { ok: false; error: string };

function parseTagFields(formData: FormData): ParsedTagFields {
  const parsedLabel = parseRequiredText(formData, "label", "Le libellé est obligatoire.");
  if (!parsedLabel.ok) return parsedLabel;

  if (parsedLabel.value.length > TAG_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Le libellé ne doit pas dépasser ${TAG_LABEL_MAX_LENGTH} caractères.`,
    };
  }

  const rawColor = String(formData.get("color") ?? "").trim();
  if (rawColor && !isTagColor(rawColor)) {
    return { ok: false, error: "Couleur invalide." };
  }

  return { ok: true, label: parsedLabel.value, color: rawColor || DEFAULT_TAG_COLOR };
}

// `label @unique` is case- and accent-sensitive in Postgres, so "Urgent" and
// "urgent" could coexist. Enforce the friendlier rule in the action rather than
// with an expression index Prisma cannot model.
async function hasLabelConflict(label: string, excludedId?: number): Promise<boolean> {
  const existing = await prisma.tag.findFirst({
    where: {
      label: { equals: label, mode: "insensitive" },
      ...(excludedId ? { id: { not: excludedId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

export const createTagFormAction = withAdminAction(
  async (_admin, _prevState: TagMutationResult | null, formData: FormData) => {
    const parsed = parseTagFields(formData);
    if (!parsed.ok) return parsed;

    if (await hasLabelConflict(parsed.label)) {
      return { ok: false, error: TAG_PRISMA_ERRORS.P2002 };
    }

    try {
      await prisma.tag.create({ data: { label: parsed.label, color: parsed.color } });
      revalidatePath(ADMIN_TAGS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describePrismaError(error, TAG_PRISMA_ERRORS) };
    }
  },
);

export const updateTagFormAction = withAdminAction(
  async (_admin, _prevState: TagMutationResult | null, formData: FormData) => {
    const parsedId = parsePositiveIntField(formData, "id", "Identifiant de tag manquant.");
    if (!parsedId.ok) return parsedId;

    const parsed = parseTagFields(formData);
    if (!parsed.ok) return parsed;

    if (await hasLabelConflict(parsed.label, parsedId.value)) {
      return { ok: false, error: TAG_PRISMA_ERRORS.P2002 };
    }

    try {
      await prisma.tag.update({
        where: { id: parsedId.value },
        data: { label: parsed.label, color: parsed.color },
      });
      revalidatePath(ADMIN_TAGS_PATH);
      // The label and colour are displayed on every case file carrying the tag.
      revalidatePath("/case_files");
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describePrismaError(error, TAG_PRISMA_ERRORS) };
    }
  },
);

export const deleteTagFormAction = withAdminAction(
  async (_admin, _prevState: TagMutationResult | null, formData: FormData) => {
    const parsedId = parsePositiveIntField(formData, "id", "Identifiant de tag manquant.");
    if (!parsedId.ok) return parsedId;

    // Re-checked server-side: the row count read at render time may be stale if
    // the tag was attached to a case file in the meantime. The `Restrict` foreign
    // key is the last-resort guard behind this one.
    const usageCount = await prisma.caseFileTag.count({ where: { tagId: parsedId.value } });
    if (usageCount > 0) {
      return {
        ok: false,
        error: `Ce tag est utilisé par ${usageCount} dossier${usageCount > 1 ? "s" : ""} et ne peut pas être supprimé.`,
      };
    }

    try {
      await prisma.tag.delete({ where: { id: parsedId.value } });
      revalidatePath(ADMIN_TAGS_PATH);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describePrismaError(error, TAG_PRISMA_ERRORS) };
    }
  },
);

// Case files blocking a tag deletion, loaded on demand when the modal opens.
// Not wrapped in `withAdminAction`, whose return type is fixed to
// `AdminMutationResult`; the admin guard is therefore called inline.
export async function listTagCaseFilesAction(tagId: number): Promise<TagCaseFilesResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  if (!Number.isInteger(tagId) || tagId <= 0) {
    return { ok: false, error: "Identifiant de tag manquant." };
  }

  try {
    return { ok: true, caseFiles: await fetchTagCaseFiles(tagId) };
  } catch (error) {
    return { ok: false, error: describePrismaError(error, TAG_PRISMA_ERRORS) };
  }
}
