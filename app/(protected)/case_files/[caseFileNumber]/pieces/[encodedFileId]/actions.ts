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

    revalidatePath(
      `/case_files/${encodeURIComponent(file.caseFileNumber)}/pieces/${encodeURIComponent(encodedFileId)}`,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
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
