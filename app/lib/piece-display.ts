export type PieceLabelInput = {
  number?: string | null;
  fileName: string;
  dahliaName?: string | null;
};

// User-facing label for a pièce: DAHLIA name when set, otherwise Télérecours filename.
export function pieceDisplayLabel(piece: PieceLabelInput): string {
  return piece.dahliaName
    ? (piece.number ? `${piece.number} - ` : "") + piece.dahliaName
    : piece.fileName;
}

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(lastDot) : "";
}

// Suggested filename when downloading: display label + extension from the original file.
export function pieceDownloadFileName(piece: PieceLabelInput): string {
  const label = pieceDisplayLabel(piece);
  const ext = fileExtension(piece.fileName);
  if (!ext || label.toLowerCase().endsWith(ext.toLowerCase())) {
    return label;
  }
  return `${label}${ext}`;
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
