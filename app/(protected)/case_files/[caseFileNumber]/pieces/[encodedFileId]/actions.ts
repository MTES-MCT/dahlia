"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";

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
  encodedFileId: string,
  input: PieceMetadataInput,
): Promise<UpdatePieceResult> {
  try {
    const number = input.number.trim();
    if (number && !/^\d+$/.test(number)) {
      return { ok: false, error: "Le numéro ne doit contenir que des chiffres." };
    }

    const file = await prisma.attachedFile.update({
      where: { encodedFileId },
      data: {
        dahliaName: input.dahliaName.trim() || null,
        number: number || null,
        comment: input.comment.trim() || null,
      },
      select: { caseFileNumber: true },
    });

    const encodedCaseFileNumber = encodeURIComponent(file.caseFileNumber);
    revalidatePath(`/case_files/${encodedCaseFileNumber}/pieces/${encodeURIComponent(encodedFileId)}`);
    // The case-file page embeds the pièces workspace, so its cache must refresh too.
    revalidatePath(`/case_files/${encodedCaseFileNumber}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Structured variant used by the inline editor of the pièces workspace, which
// holds its own client state instead of relying on a native <form> submission.
export async function savePieceMetadataAction(
  encodedFileId: string,
  input: PieceMetadataInput,
): Promise<UpdatePieceResult> {
  const trimmed = encodedFileId.trim();
  if (!trimmed) {
    return { ok: false, error: "Identifiant de pièce manquant." };
  }
  return persistPieceMetadata(trimmed, input);
}

export async function updatePieceMetadataFormAction(
  _prevState: UpdatePieceResult | null,
  formData: FormData,
): Promise<UpdatePieceResult> {
  const encodedFileId = String(formData.get("encodedFileId") ?? "").trim();
  if (!encodedFileId) {
    return { ok: false, error: "Identifiant de pièce manquant." };
  }

  return persistPieceMetadata(encodedFileId, {
    dahliaName: String(formData.get("dahliaName") ?? ""),
    number: String(formData.get("number") ?? ""),
    comment: String(formData.get("comment") ?? ""),
  });
}
