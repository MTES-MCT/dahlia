"use server";

import { revalidatePath } from "next/cache";
import { caseFileHref, type CaseFileKey } from "@/app/lib/case-file-key";
import { prisma } from "@/app/lib/prisma";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { describePrismaError } from "@/app/lib/form-actions";
import { PIECE_COMMENT_MAX_LENGTH } from "@/app/lib/piece-comment";
import { dahliaNameValidationError } from "@/app/lib/sanitize-file-name";
import {
  applyDahliaNameUpdate,
  type DahliaNamePiece,
} from "@/data/persistence/attached-file-dahlia-name";

export type UpdatePieceResult = { ok: true } | { ok: false; error: string };

type PieceMetadataInput = {
  dahliaName: string;
  comment: string;
  // Left untouched when omitted.
  isFavorite?: boolean;
};

// Persist user-editable metadata (renamed name, comment, favorite) of a pièce
// through `write`, after checking it lies within the caller's permission scope.
async function persistPieceData(
  key: CaseFileKey,
  encodedFileId: string,
  write: (piece: DahliaNamePiece) => Promise<unknown>,
): Promise<UpdatePieceResult> {
  try {
    // Scoped read: null when the pièce is unknown, belongs to another case file
    // *or* to a case file outside the caller's permission scope. Same wording.
    const piece = await fetchAttachedFile(key, encodedFileId);
    if (!piece) {
      return { ok: false, error: "Pièce introuvable." };
    }

    await write({
      jurisdictionCode: key.jurisdictionCode,
      encodedFileId,
      dahliaName: piece.dahliaName ?? null,
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
  const comment = input.comment.trim();
  if (comment.length > PIECE_COMMENT_MAX_LENGTH) {
    return { ok: false, error: "Commentaire trop long." };
  }
  const trimmedDahliaName = input.dahliaName.trim();
  if (trimmedDahliaName) {
    const dahliaNameError = dahliaNameValidationError(trimmedDahliaName);
    if (dahliaNameError) {
      return { ok: false, error: dahliaNameError };
    }
  }
  // Empty strings are stored as null. A rename is logged in the pièce history
  // (`field_changes`, origin "user").
  return persistPieceData(key, trimmed, (piece) =>
    applyDahliaNameUpdate(prisma, piece, trimmedDahliaName || null, "user", {
      otherData: {
        comment: comment || null,
        ...(input.isFavorite === undefined ? {} : { isFavorite: input.isFavorite }),
      },
    }),
  );
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
  return persistPieceData(key, trimmed, (piece) =>
    prisma.attachedFile.update({
      where: {
        jurisdictionCode_encodedFileId: {
          jurisdictionCode: piece.jurisdictionCode,
          encodedFileId: piece.encodedFileId,
        },
      },
      data: { isFavorite, updatedAt: new Date() },
    }),
  );
}
