// Identifies a case file. Telerecours case-file numbers (like every other
// Telerecours id) are only unique within a court, so the key pairs the number
// with the court code (`jurisdictionCode`, e.g. "TA069" for both the TA069 and
// TA069bis instances, see Jurisdiction.jurisdictionCode).
export interface CaseFileKey {
  jurisdictionCode: string;
  caseFileNumber: string;
}
