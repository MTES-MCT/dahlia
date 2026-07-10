export interface Quality {
  code: string;
  name: string;
}

export interface Actor {
  id: number;
  firstName: string | null;
  lastName: string | null;
  lastFirstName: string | null;
  firstLastName: string | null;
  legalPersonName: string | null;
  legalEntityName: string | null;
  legalEntityId: number | null;
  actorType: string;
  quality?: Quality;
}

export interface Hearing {
  hearingId: string;
  convocationDate: string;
  room: string | null;
  creationDate: string | null;
  modificationDates: string[] | null;
  lastConclusion?: {
    id: number;
    conclusionSense: string;
    publicationDate: string;
    author: string | null;
    conclusionOperativePart?: { id: number; label: string };
  } | null;
}

export interface CaseFile {
  caseFileNumber: string;
  assignedToLegalEntityDivision?: { id: number; name: string; shortName: string };
  urgency?: { id: number; key: string | null; description: string; colorHexadecimalCode: string };
  lastStatus?: { id: number; label: string; statusDate: string; category: string; groupId: number };
  lastHearing?: Hearing;
  procedureState?: string | null;
  mainClaimant?: Actor;
  mainDefender?: Actor;
  [key: string]: unknown;
}

// Réponse enrichie de /api/case-file/<id> (un seul dossier, pas paginé).
// Hérite de CaseFile + champs détail.
export interface LastDecisionReading {
  readingDate: string;
  notificationDate?: string | null;
  nature?: string | null;
  operativePart?: string | null;
}

export interface CaseFileDetail extends CaseFile {
  title?: string | null;
  creationDate?: string | null;
  depositDate?: string | null;
  type?: string | null;
  estimatedHearingDate?: string | null;
  estimatedHearingPeriod?: string | null;
  earliestInstructionClosingDate?: string | null;
  chamber?: { id: number; name: string } | null;
  lastDecisionReading?: LastDecisionReading | null;
  directory?: {
    reference?: string | null;
    complementaryRecipientEmails?: string | null;
  } | null;
  keywords?: string[] | null;
  recipientContactCount?: number | null;
}

// Catalogue de mesures (type d'événement). `id` ici est un code string
// (ex. "RECMEM", "ORDCLOT") — à ne pas confondre avec l'`id` numérique
// d'un événement.
export interface Measure {
  id: string;
  label: string;
  type: string;
  isImportant: boolean;
  family: string | null;
}

// Un événement / mesure appliqué à un dossier (réponse de
// /api/case-file/<id>/measures).
export interface CaseFileEvent {
  id: number;
  subEventId: number;
  eventDate: string;
  deadlineLabel: string | null;
  receiptDate: string | null;
  instructionClosingDate: string | null;
  comment: string | null;
  actor:
    | (Actor & {
        isMainClaimant?: boolean;
        isMainDefender?: boolean;
        representedBy?: Actor[];
      })
    | null;
  measure: Measure;
  hasAttachment: boolean;
  generateAR: boolean;
  nbEventFile: number;
  piecesNonDownloadable: boolean | null;
  relatedEventCount: number;
}

// Pièce jointe d'un dossier (réponse de /api/file-api/<id>).
export interface AttachedFile {
  encodedFileId: string;
  originalFileName: string;
  fileName: string;
  mimeType: string;
  documentType: string;
  eventId: number;
  subEventId: number;
  receiptAcknowledgmentId: number | null;
  receiptAcknowledgmentType: string | null;
  fileFamilyType: string;
  fileTypeLabel: string;
  measure: {
    measureId: string;
    measureType: string;
    measureLabel: string;
  };
  eventCreationDate: string;
}

// Entrée du rapport des dossiers liés (réponse de
// /api/case-file/<id>/related-case-files-report). Les acteurs n'ont pas
// d'ID — uniquement des noms.
export interface RelatedCaseFileSummary {
  caseFileNumber: string;
  lastStatus?: {
    id: number;
    label: string;
    statusDate: string;
    category: string;
    groupId: number;
  } | null;
  mainClaimant?: {
    firstName: string | null;
    lastName: string | null;
    lastFirstName: string | null;
    firstLastName: string | null;
  } | null;
  mainDefender?: {
    firstName: string | null;
    lastName: string | null;
    lastFirstName: string | null;
    firstLastName: string | null;
  } | null;
}

// Page paginée renvoyée par l'API Télérecours (hearings, measures,
// attached-files, list).
export interface PageInfo {
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface PagedResponse<T> {
  content: T[];
  page?: PageInfo;
}
