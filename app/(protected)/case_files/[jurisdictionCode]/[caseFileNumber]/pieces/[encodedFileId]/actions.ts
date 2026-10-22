"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { caseFileHref, type CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { describePrismaError } from "@/app/lib/form-actions";

export type UpdatePieceResult = { ok: true } | { ok: false; error: string };

type PieceMetadataInput = {
  dahliaName: string;
  comment: string;
  // Left untouched when omitted.
  isFavorite?: boolean;
};

// Persist user-editable metadata (renamed name, comment, favorite) of a pièce,
// after checking it lies within the caller's permission scope.
async function persistPieceData(
  key: CaseFileKey,
  encodedFileId: string,
  data: Prisma.AttachedFileUpdateInput,
): Promise<UpdatePieceResult> {
  try {
    // Scoped read: null when the pièce is unknown, belongs to another case file
    // *or* to a case file outside the caller's permission scope. Same wording.
    if (!(await fetchAttachedFile(key, encodedFileId))) {
      return { ok: false, error: "Pièce introuvable." };
    }

    await prisma.attachedFile.update({
      where: {
        jurisdictionCode_encodedFileId: { jurisdictionCode: key.jurisdictionCode, encodedFileId },
      },
      data,
    });

    revalidatePath(caseFileHref(key));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describePrismaError(error) };
  }
}

// Structured variant used by the inline editor of the pièces workspace, which
// holds its own client state instead of relying on a native <form> submission.
export async function savePieceMetadataAction(
  key: CaseFileKey,
  encodedFileId: string,
  input: PieceMetadataInput,
): Promise<UpdatePieceResult> {
  const trimmed = encodedFileId.trim();
  if (!trimmed) {
    return { ok: false, error: "Identifiant de pièce manquant." };
  }
  // Empty strings are stored as null.
  return persistPieceData(key, trimmed, {
    dahliaName: input.dahliaName.trim() || null,
    comment: input.comment.trim() || null,
    ...(input.isFavorite === undefined ? {} : { isFavorite: input.isFavorite }),
  });
}

// Star toggle of the pièces sidebar: only flips the favorite flag.
export async function setPieceFavoriteAction(
  key: CaseFileKey,
  encodedFileId: string,
  isFavorite: boolean,
): Promise<UpdatePieceResult> {
  const trimmed = encodedFileId.trim();
  if (!trimmed) {
    return { ok: false, error: "Identifiant de pièce manquant." };
  }
  return persistPieceData(key, trimmed, { isFavorite });
}
