import Link from "next/link";
import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { type CaseFilePiece } from "@/app/lib/data/attached-files";
import { pieceDisplayLabel, pieceEditionHref } from "@/app/lib/piece-display";

type PieceWithFamily = Pick<
  CaseFilePiece,
  | "encodedFileId"
  | "number"
  | "fileName"
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
          {pieceDisplayLabel(file)}
        </Link>
        <div className={clsx(fr.cx("fr-text--sm"), "text-grey", "italic")}>{file.fileName}</div>
      </div>
    );
  }

  return (
    <Link href={href} className={fr.cx("fr-link")}>
      {file.fileName}
    </Link>
  );
}

export function renderPieceCommentCell(piece: Pick<CaseFilePiece, "comment">): React.ReactNode {
  if (!piece.comment) {
    return "—";
  }

  return <div className="line-clamp-2">{piece.comment}</div>;
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
