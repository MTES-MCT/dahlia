export interface CaseFile {
    caseFileNumber: string;
    assignedToLegalEntityDivision?: { id: number; name: string; shortName: string };
    urgency?: { id: number; key: string | null; description: string; colorHexadecimalCode: string };
    lastStatus?: { id: number; label: string; statusDate: string; category: string; groupId: number };
    lastHearing?: {
      hearingId: string;
      convocationDate: string;
      room: string;
      lastConclusion?: {
        id: number;
        conclusionSense: string;
        publicationDate: string;
        author: string | null;
        conclusionOperativePart?: { id: number; label: string };
      };
    };
    procedureState?: string | null;
    mainClaimant?: {
      id: number;
      firstName: string | null;
      lastName: string | null;
      lastFirstName: string | null;
      firstLastName: string | null;
      legalPersonName: string | null;
      legalEntityName: string | null;
      legalEntityId: number | null;
      actorType: string;
      quality?: { code: string; name: string };
    };
    mainDefender?: {
      id: number;
      firstName: string | null;
      lastName: string | null;
      lastFirstName: string | null;
      firstLastName: string | null;
      legalPersonName: string | null;
      legalEntityName: string | null;
      legalEntityId: number | null;
      actorType: string;
      quality?: { code: string; name: string };
    };
    [key: string]: unknown;
  }