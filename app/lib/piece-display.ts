type PieceLabelInput = {
  originalFileName: string;
  dahliaName?: string | null;
};

// User-facing label for a pièce: DAHLIA name when set, otherwise Télérecours filename.
export function pieceDisplayLabel(piece: PieceLabelInput): string {
  return piece.dahliaName ?? piece.originalFileName;
}

type PieceEditionHrefInput = {
  caseFileNumber: string;
  encodedFileId: string;
  queryString?: string;
};

// Route to the pièce edition page, preserving optional search/sort/tab query params.
export function pieceEditionHref({
  caseFileNumber,
  encodedFileId,
  queryString,
}: PieceEditionHrefInput): string {
  const suffix = queryString ? `?${queryString}` : "";
  return `/case_files/${encodeURIComponent(caseFileNumber)}/pieces/${encodeURIComponent(encodedFileId)}${suffix}`;
}
