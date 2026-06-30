import { type CarriedSearchParams } from "@/app/lib/carried-search-params";
import { pieceDisplayLabel, type PieceLabelInput } from "@/app/lib/piece-display";
import {
  buildCaseFileBreadcrumbSegment,
  CaseFileBreadcrumb,
  type CaseFileForBreadcrumb,
} from "@/app/ui/breadcrumb/case-file-breadcrumb";

type PieceForBreadcrumb = PieceLabelInput & {
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
