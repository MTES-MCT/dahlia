// Identify "commission de médiation" (COMED) decisions from attached-file
// metadata (name + file family), never from the file content.
//
// Direct port of comed-final.sql. The stored `*Normalized` columns are already
// lowercase and unaccented (Postgres `f_unaccent`) but still contain separators;
// `normalizeComedSearchName` does the separator rewrite the SQL CTE does, and
// the patterns below are the same POSIX expressions. Do not "fix" the trailing
// space on `arretes?` / `annulation` — the SQL requires it.

export type ComedVerdict = "certain" | "probable";

export interface ComedNameSource {
  dahliaNameNormalized: string | null;
  fileNameNormalized: string | null;
  fileTypeLabel: string | null;
}

export interface ComedDecision {
  caseFileNumber: string;
  caseFileTitle: string | null;
  encodedFileId: string;
  fileName: string;
  fileTypeLabel: string;
  eventCreationDate: Date;
  verdict: ComedVerdict;
}

export interface AttachedFileComedSource extends ComedNameSource {
  encodedFileId: string;
  caseFileNumber: string;
  fileName: string;
  fileTypeLabel: string;
  eventCreationDate: Date;
  caseFile: { title: string | null };
}

const AUTEUR_COMED = [
  "(^| )comed( |$)",
  "commission( de| la| departementale| dep| dptale)* mediation",
  "commission( de| du)? dalo",
  "commission (du )?droit au logement opposable",
].map((pattern) => new RegExp(pattern));

// "decicsion" is a typo that actually occurs in the data.
const EST_DECISION = [
  "(^| )(decision|decisions|decicsion)( |$)",
  "notification (de la )?decision",
].map((pattern) => new RegExp(pattern));

const EST_ACTE_ATTAQUE = [
  "(^| )(acte|actes) (attaque|attaques|litigieux)( |$)",
  "decisions? (attaquee?s?|contestees?|litigieuses?)( |$)",
].map((pattern) => new RegExp(pattern));

const ANTI_MOTIF = [
  "(^| )(recours|saisine|rapo)( |$)",
  "reglement interieur",
  "(^| )arretes? ",
  "composition",
  "justificatif de depot",
  "demande (de |)(pieces|documents|indemnitaire|prealable)",
  "indemnitaire",
  "accuse de reception du",
  "(^| )(courrier|courriers|lettre|echanges|message|messages|historique|correspondance)( |$)",
  "(^| )(prefet|prefete|prefecture|ddcs)( |$)",
  "(annule|annulant|annulation) ",
].map((pattern) => new RegExp(pattern));

const STRIP_AUTEUR_COMED = new RegExp(
  "(^| )(comed|commission( de| la| departementale| dep| dptale)* mediation|commission( de| du)? dalo|commission (du )?droit au logement opposable)( |$)",
  "g",
);

// Rule D: a COMED-only name may keep a word from this decision vocabulary
// (1_Rejet_COMED_17.12.24.pdf) and still count as certain.
const DECISION_VOCABULARY = new Set(["rejet", "rejets", "notification", "notifications"]);

const STOP_WORDS = new Set([
  "pdf",
  "doc",
  "docx",
  "du",
  "de",
  "des",
  "d",
  "la",
  "le",
  "l",
  "les",
  "et",
  "a",
  "au",
  "aux",
  "en",
  "n",
  "no",
  "bis",
  "ter",
  "piece",
  "pieces",
  "pj",
  "p",
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
]);

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

// Lowercase + unaccented columns, then any separator becomes a single space.
// Leading/trailing spaces are kept, as in the SQL `regexp_replace`.
export function normalizeComedSearchName(
  dahliaNameNormalized: string | null | undefined,
  fileNameNormalized: string | null | undefined,
): string {
  return `${dahliaNameNormalized ?? ""} ${fileNameNormalized ?? ""}`.replace(/[^a-z0-9]+/g, " ");
}

// Meaningful words left once the COMED mention, digits, the extension and
// function words are removed. Order does not matter (SQL uses array containment).
export function residualWords(normalizedName: string): string[] {
  const reste = normalizedName.replace(STRIP_AUTEUR_COMED, " ");
  return reste
    .split(" ")
    .filter((word) => word !== "" && !/^[0-9]+$/.test(word) && !STOP_WORDS.has(word));
}

function residualIsDecisionVocabulary(words: readonly string[]): boolean {
  return words.every((word) => DECISION_VOCABULARY.has(word));
}

// `null` when the file is not a COMED decision (SQL verdict "non", dropped by
// the WHERE). "certain" when the name states both the author and the nature,
// or states nothing but the COMED. "probable" when the family label is
// "Décision" (code DEC; null is not that family) and the name states a
// decision or an attacked act without naming the COMED.
export function classifyComedDecision(source: ComedNameSource): ComedVerdict | null {
  const name = normalizeComedSearchName(source.dahliaNameNormalized, source.fileNameNormalized);
  if (matchesAny(name, ANTI_MOTIF)) return null;

  const auteurComed = matchesAny(name, AUTEUR_COMED);
  const estDecision = matchesAny(name, EST_DECISION);
  const estActeAttaque = matchesAny(name, EST_ACTE_ATTAQUE);

  if (auteurComed && estDecision) return "certain";
  if (auteurComed && residualIsDecisionVocabulary(residualWords(name))) return "certain";
  if (source.fileTypeLabel === "Décision" && (estDecision || estActeAttaque)) return "probable";
  return null;
}

export function selectComedDecisions(files: readonly AttachedFileComedSource[]): ComedDecision[] {
  const decisions: ComedDecision[] = [];
  for (const file of files) {
    const verdict = classifyComedDecision(file);
    if (!verdict) continue;
    decisions.push({
      caseFileNumber: file.caseFileNumber,
      caseFileTitle: file.caseFile.title,
      encodedFileId: file.encodedFileId,
      fileName: file.fileName,
      fileTypeLabel: file.fileTypeLabel,
      eventCreationDate: file.eventCreationDate,
      verdict,
    });
  }
  return decisions;
}

export function countComedDossiers(decisions: readonly { caseFileNumber: string }[]): number {
  return new Set(decisions.map((decision) => decision.caseFileNumber)).size;
}
