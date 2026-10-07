"use server";

import { revalidatePath } from "next/cache";
import { caseFileHref, type CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { describePrismaError } from "@/app/lib/form-actions";

export type UpdatePieceResult = { ok: true } | { ok: false; error: string };

type PieceMetadataInput = {
  dahliaName: string;
  number: string;
  comment: string;
};

// Persist the user-editable metadata (renamed name, number, comment) of a pièce.
// All fields are optional: empty strings are stored as null. `number` keeps its
// leading zeros because it is a string column (e.g. "002").
async function persistPieceMetadata(
  key: CaseFileKey,
  encodedFileId: string,
  input: PieceMetadataInput,
): Promise<UpdatePieceResult> {
  try {
    const number = input.number.trim();
    if (number && !/^\d+$/.test(number)) {
      return { ok: false, error: "Le numéro ne doit contenir que des chiffres." };
    }

    // Scoped read: null when the pièce is unknown, belongs to another case file
    // *or* to a case file outside the caller's permission scope. Same wording.
    if (!(await fetchAttachedFile(key, encodedFileId))) {
      return { ok: false, error: "Pièce introuvable." };
    }

    await prisma.attachedFile.update({
      where: {
        jurisdictionCode_encodedFileId: { jurisdictionCode: key.jurisdictionCode, encodedFileId },
      },
      data: {
        dahliaName: input.dahliaName.trim() || null,
        number: number || null,
        comment: input.comment.trim() || null,
      },
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
  return persistPieceMetadata(key, trimmed, input);
}
