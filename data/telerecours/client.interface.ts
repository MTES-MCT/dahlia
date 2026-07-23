import {
  AttachedFile,
  CaseFile,
  CaseFileActorDto,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  PagedResponse,
  RelatedCaseFileSummary,
  StatusGroup,
  StatusGroupType,
} from "./types";

// The set of Telerecours operations the scraping pipeline depends on. The
// concrete `TelerecoursClient` (client.ts) implements it; tests provide a fake
// returning canned fixtures. Because the methods are typed against the DTOs,
// a fixture that drifts from the real shape is caught by the type checker.
export interface TelerecoursClient {
  getStatusGroups(jurisdiction: string, statusType: StatusGroupType): Promise<StatusGroup[]>;

  getInProgressStatusGroupIds(jurisdiction: string): Promise<number[]>;

  getCaseFiles(
    jurisdiction: string,
    page: number,
    size: number,
    sort?: string,
    statusGroupIds?: number[],
    legalEntityDivisionIds?: number[],
  ): Promise<PagedResponse<CaseFile>>;

  getCaseFileDetail(caseFileNumber: string, jurisdiction: string): Promise<CaseFileDetail>;

  getCaseFileActors(
    caseFileNumber: string,
    jurisdiction: string,
    page?: number,
    size?: number,
  ): Promise<PagedResponse<CaseFileActorDto>>;

  getCaseFileHearings(
    caseFileNumber: string,
    jurisdiction: string,
    page?: number,
    size?: number,
  ): Promise<PagedResponse<Hearing>>;

  getCaseFileMeasures(
    caseFileNumber: string,
    jurisdiction: string,
    page?: number,
    size?: number,
  ): Promise<PagedResponse<CaseFileEvent>>;

  getCaseFileAttachedFiles(
    caseFileNumber: string,
    jurisdiction: string,
    page?: number,
    size?: number,
  ): Promise<PagedResponse<AttachedFile>>;

  getCaseFileRelatedReport(
    caseFileNumber: string,
    jurisdiction: string,
  ): Promise<{ accessibleCaseFiles?: RelatedCaseFileSummary[] }>;

  downloadFile(
    encodedFileId: string,
    jurisdiction: string,
  ): Promise<{ data: Buffer; fileName?: string; mimeType?: string }>;
}
