export type PieceLabelInput = {
  fileName: string;
  dahliaName?: string | null;
};

// User-facing label for a pièce: DAHLIA name when set, otherwise Télérecours filename.
export function pieceDisplayLabel(piece: PieceLabelInput): string {
  return piece.dahliaName || piece.fileName;
}

export type PieceSortInput = PieceLabelInput & { eventCreationDate: Date | null };

// Calendar day (YYYY-MM-DD) in the same time zone as `formatDateFr`, so pièces
// displayed with the same date compare as equal whatever their time.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function eventDayKey(piece: PieceSortInput): string {
  return piece.eventCreationDate ? dayKeyFormat.format(piece.eventCreationDate) : "";
}

// Pièces list order: most recent event day first, then display label A→Z
// (accent/case-insensitive, numbers in natural order). Undated pièces last.
export function comparePiecesByDateDescThenName(a: PieceSortInput, b: PieceSortInput): number {
  const byDay = eventDayKey(b).localeCompare(eventDayKey(a));
  if (byDay !== 0) return byDay;
  return pieceDisplayLabel(a).localeCompare(pieceDisplayLabel(b), "fr", {
    sensitivity: "base",
    numeric: true,
  });
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
