import { type CarriedSearchParams } from "@/app/lib/carried-search-params";
import { pieceDisplayLabel } from "@/app/lib/piece-display";
import {
  buildCaseFileBreadcrumbSegment,
  CaseFileBreadcrumb,
  type CaseFileForBreadcrumb,
} from "@/app/ui/breadcrumb/case-file-breadcrumb";

type PieceForBreadcrumb = {
  originalFileName: string;
  dahliaName?: string | null;
  caseFile: CaseFileForBreadcrumb;
};

type Props = {
  piece: PieceForBreadcrumb;
  searchParams: CarriedSearchParams;
};

export function PieceCaseFileBreadcrumb({ piece, searchParams }: Props) {
  return (
    <CaseFileBreadcrumb
      caseFile={piece.caseFile}
      searchParams={searchParams}
      currentPageLabel={pieceDisplayLabel(piece)}
      trailingSegments={[buildCaseFileBreadcrumbSegment(piece.caseFile, searchParams)]}
    />
  );
}
