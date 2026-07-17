// Fixture builders for Telerecours DTOs. They return minimal-but-valid objects
// (enough for the upsert/enrich code to accept them) and take a partial
// override so each test can tweak just the fields it cares about. Because they
// are typed against the real DTOs, a drift in the API types breaks the fixtures
// at compile time.
import {
  Actor,
  AttachedFile,
  CaseFile,
  CaseFileActorDto,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  PagedResponse,
  RelatedCaseFileSummary,
} from "../telerecours/types";

export function actorFixture(over: Partial<Actor> = {}): Actor {
  return {
    id: 1001,
    firstName: "Jean",
    lastName: "Dupont",
    lastFirstName: "Dupont Jean",
    firstLastName: "Jean Dupont",
    legalPersonName: null,
    legalEntityName: null,
    legalEntityId: null,
    actorType: "NATURAL_PERSON",
    quality: { code: "R", name: "Requérant" },
    ...over,
  };
}

export function caseFileActorDtoFixture(over: Partial<CaseFileActorDto> = {}): CaseFileActorDto {
  return {
    ...actorFixture(),
    isMainClaimant: true,
    isMainDefender: false,
    representedBy: [],
    ...over,
  };
}

export function caseFileFixture(over: Partial<CaseFile> = {}): CaseFile {
  return {
    caseFileNumber: "TA069-001",
    assignedToLegalEntityDivision: { id: 2488, name: "DDETS du Rhône", shortName: "DDETS69" },
    urgency: undefined,
    lastStatus: {
      id: 5,
      label: "En cours",
      statusDate: "2026-01-10T00:00:00Z",
      category: "INSTRUCTION",
      groupId: 2,
    },
    lastHearing: undefined,
    procedureState: "OPEN",
    mainClaimant: actorFixture(),
    mainDefender: actorFixture({ id: 2002, actorType: "LEGAL_PERSON", legalPersonName: "PRÉFET" }),
    ...over,
  };
}

export function caseFileDetailFixture(over: Partial<CaseFileDetail> = {}): CaseFileDetail {
  return {
    ...caseFileFixture(),
    title: "Recours DALO",
    creationDate: "2025-12-01T00:00:00Z",
    depositDate: "2025-12-02T00:00:00Z",
    type: "DALO",
    keywords: [],
    chamber: { id: 7, name: "1ère chambre" },
    lastDecisionReading: null,
    ...over,
  };
}

export function hearingFixture(over: Partial<Hearing> = {}): Hearing {
  return {
    hearingId: "H-001",
    convocationDate: "2026-03-01T09:00:00Z",
    room: "Salle A",
    creationDate: "2026-02-01T00:00:00Z",
    modificationDates: [],
    lastConclusion: null,
    ...over,
  };
}

export function eventFixture(over: Partial<CaseFileEvent> = {}): CaseFileEvent {
  return {
    id: 90001,
    subEventId: 0,
    eventDate: "2026-01-05T00:00:00Z",
    deadlineLabel: null,
    receiptDate: null,
    instructionClosingDate: null,
    comment: null,
    actor: actorFixture(),
    measure: {
      id: "RECMEM",
      label: "Réception mémoire",
      type: "T",
      isImportant: false,
      family: null,
    },
    hasAttachment: false,
    generateAR: false,
    nbEventFile: 0,
    piecesNonDownloadable: null,
    relatedEventCount: 0,
    ...over,
  };
}

export function attachedFileFixture(over: Partial<AttachedFile> = {}): AttachedFile {
  return {
    encodedFileId: "ENC-001",
    originalFileName: "memoire.pdf",
    fileName: "memoire.pdf",
    mimeType: "application/pdf",
    documentType: "MEMOIRE",
    eventId: 90001,
    subEventId: 0,
    receiptAcknowledgmentId: null,
    receiptAcknowledgmentType: null,
    fileFamilyType: "FAM",
    fileTypeLabel: "Mémoire",
    measure: { measureId: "RECMEM", measureType: "T", measureLabel: "Réception mémoire" },
    eventCreationDate: "2026-01-05T00:00:00Z",
    ...over,
  };
}

export function relatedSummaryFixture(
  over: Partial<RelatedCaseFileSummary> = {},
): RelatedCaseFileSummary {
  return {
    caseFileNumber: "TA069-002",
    lastStatus: null,
    mainClaimant: null,
    mainDefender: null,
    ...over,
  };
}

// Wrap items into a single-page PagedResponse.
export function page<T>(content: T[], totalPages = 1, number = 0): PagedResponse<T> {
  return { content, page: { number, totalPages, totalElements: content.length } };
}

// Wrap items into an empty page (used to terminate paginate() loops).
export function emptyPage<T>(): PagedResponse<T> {
  return { content: [], page: { number: 0, totalPages: 1, totalElements: 0 } };
}
