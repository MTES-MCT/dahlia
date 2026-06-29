import Link from "next/link";
import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { type CaseFilePiece } from "@/app/lib/data/attached-files";
import { pieceEditionHref } from "@/app/lib/piece-display";

type PieceWithFamily = Pick<
  CaseFilePiece,
  | "encodedFileId"
  | "originalFileName"
  | "dahliaName"
  | "fileTypeLabel"
  | "fileFamilyType"
  | "fileFamilyTypeLabel"
>;

function pieceRowHref(caseFileNumber: string, queryString: string, piece: PieceWithFamily): string {
  return pieceEditionHref({
    caseFileNumber,
    encodedFileId: piece.encodedFileId,
    queryString: queryString || undefined,
  });
}

export function renderPieceNameCell(
  file: PieceWithFamily,
  caseFileNumber: string,
  queryString: string,
): React.ReactNode {
  const href = pieceRowHref(caseFileNumber, queryString, file);

  if (file.dahliaName) {
    return (
      <div>
        <Link href={href} className={fr.cx("fr-link")}>
          {file.dahliaName}
        </Link>
        <div className={clsx(fr.cx("fr-text--sm"), "text-grey", "italic")}>
          {file.originalFileName}
        </div>
      </div>
    );
  }

  return (
    <Link href={href} className={fr.cx("fr-link")}>
      {file.originalFileName}
    </Link>
  );
}

export function renderPieceTypeCell(file: PieceWithFamily): React.ReactNode {
  const familyTypeLabel = file.fileFamilyType?.label ?? file.fileFamilyTypeLabel;
  if (familyTypeLabel && familyTypeLabel !== file.fileTypeLabel) {
    return (
      <div>
        <div>{file.fileTypeLabel}</div>
        <div className={clsx(fr.cx("fr-text--sm"), "text-grey", "italic")}>{familyTypeLabel}</div>
      </div>
    );
  }

  return file.fileTypeLabel;
}
