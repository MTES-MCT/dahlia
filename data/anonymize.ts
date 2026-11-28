import { fakerFR } from "@faker-js/faker";
import { createHash } from "node:crypto";
import { Actor, CaseFileDetail } from "./telerecours/types";

function seedFor(value: string): number {
  return createHash("sha256").update(value).digest().readUInt32BE(0);
}

function deterministic<T>(source: string | null | undefined, fn: () => T): T {
  if (source) fakerFR.seed(seedFor(source));
  else fakerFR.seed();
  return fn();
}

export function anonymizeActor(actor: Actor): Actor {
  if (actor.actorType === "NATURAL_PERSON") {
    const firstName = deterministic(actor.firstName, () => fakerFR.person.firstName());
    const lastName = deterministic(actor.lastName, () => fakerFR.person.lastName().toUpperCase());
    const firstLastName = firstName + " " + lastName;
    const lastFirstName = lastName + " " + firstName;

    let legalEntityName = actor.legalEntityName;
    if (actor.legalEntityName) {
      legalEntityName = lastFirstName;
    }
    return {
      ...actor,
      firstName,
      lastName,
      lastFirstName: lastFirstName,
      firstLastName: firstLastName,
      legalEntityName: legalEntityName,
    };
  }

  // We don't anonymize legal persons for now because it usually is "PREFET•E"
  // if (actor.actorType === "LEGAL_PERSON") {
  //   return {
  //     ...actor,
  //     legalPersonName: fakerFR.company.name(),
  //   };
  // }

  return actor;
}

export const FAKE_EMAIL = "fake@example.fr";

export type NameScrubber = (text: string) => string;

export const KEEP_NAMES: NameScrubber = (text) => text;

// Lowercase particles too common in file names to be replaced on their own
// ("pieces_des_parties"). Shorter tokens are ignored altogether.
const NAME_PARTICLES = new Set([
  "ben",
  "bin",
  "ibn",
  "del",
  "des",
  "das",
  "dos",
  "les",
  "van",
  "von",
]);
const MIN_NAME_TOKEN_LENGTH = 3;

const NOT_ALPHANUMERIC = String.raw`[^\p{L}\p{N}]`;

function stripMarks(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function nameWords(name: string): string[] {
  return stripMarks(name)
    .split(new RegExp(`${NOT_ALPHANUMERIC}+`, "u"))
    .filter(Boolean);
}

// Identity of a name whatever its case, accents and separators.
function nameKey(name: string): string {
  return nameWords(name).join("").toLowerCase();
}

// Matches a name in decomposed (NFD) text, with or without its accents and with
// any separator between its words ("Le Gall", "le_gall", "LE-GALL", "LEGALL").
function namePattern(name: string): string {
  return nameWords(name)
    .map((word) => [...word].map((char) => String.raw`${char}\p{M}*`).join(""))
    .join(`${NOT_ALPHANUMERIC}*`);
}

function isReplaceableToken(token: string): boolean {
  return token.length >= MIN_NAME_TOKEN_LENGTH && !NAME_PARTICLES.has(token.toLowerCase());
}

// Build a function replacing the names of `actors` by the fake names
// anonymizeActor() gives them, so that a text stays consistent with the
// anonymized actors. Each word of a compound name is also replaced on its own
// ("SALAH" for "BEN SALAH"). Legal persons are kept, as in anonymizeActor().
export function createNameScrubber(actors: Actor[]): NameScrubber {
  const replacements = new Map<string, { fake: string; pattern: string }>();
  const addName = (name: string, fake: string) => {
    const key = nameKey(name);
    if (key && !replacements.has(key)) replacements.set(key, { fake, pattern: namePattern(name) });
  };
  const add = (source: string | null, fake: string | null, withTokens: boolean) => {
    if (!source || !fake) return;
    addName(source, fake);
    if (!withTokens) return;
    for (const token of nameWords(source).filter(isReplaceableToken)) addName(token, fake);
  };

  for (const actor of actors) {
    if (actor.actorType !== "NATURAL_PERSON") continue;
    const anonymized = anonymizeActor(actor);
    add(actor.lastName, anonymized.lastName, true);
    add(actor.firstName, anonymized.firstName, true);
    add(actor.legalEntityName, anonymized.legalEntityName, false);
  }
  if (replacements.size === 0) return KEEP_NAMES;

  // Longest names first: a compound name wins over its own words.
  const alternatives = [...replacements.entries()]
    .sort(([a], [b]) => b.length - a.length)
    .map(([, { pattern }]) => pattern)
    .join("|");
  const pattern = new RegExp(
    String.raw`(?<![\p{L}\p{N}\p{M}])(?:${alternatives})(?![\p{L}\p{N}\p{M}])`,
    "giu",
  );

  // A single pass, so that a fake name is never replaced in turn.
  return (text) => {
    const decomposed = text.normalize("NFD");
    const scrubbed = decomposed.replace(
      pattern,
      (match) => replacements.get(nameKey(match))?.fake ?? match,
    );
    return scrubbed === decomposed ? text : scrubbed.normalize("NFC");
  };
}

// Free texts of the detail, stripped of personal data. The complementary emails
// are not tied to any actor: they are replaced whatever their content.
export function anonymizeCaseFileDetail(
  detail: CaseFileDetail,
  scrubNames: NameScrubber,
): CaseFileDetail {
  const { title, directory, lastDecisionReading } = detail;
  return {
    ...detail,
    title: title && scrubNames(title),
    directory: directory && {
      ...directory,
      complementaryRecipientEmails: directory.complementaryRecipientEmails && FAKE_EMAIL,
    },
    lastDecisionReading: lastDecisionReading && {
      ...lastDecisionReading,
      operativePart:
        lastDecisionReading.operativePart && scrubNames(lastDecisionReading.operativePart),
    },
  };
}

// ───── DocumentIA results ─────

const DEMANDEUR = "demandeur";

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapStrings(value: Json, fn: (text: string) => string): Json {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]),
    );
  }
  return value;
}

function isUpperCaseWord(word: string): boolean {
  return word === word.toUpperCase() && word !== word.toLowerCase();
}

// The claimant as extracted by DocumentIA ("NOM Prénom", or { nom, prenom } in
// older schemas) as a natural person: upper-case words make the last name, the
// others the first name. Without any upper-case word, the whole value is taken
// as the last name.
export function demandeurActor(demandeur: Json): Actor | null {
  let lastName: string | null = null;
  let firstName: string | null = null;
  if (typeof demandeur === "string") {
    const words = demandeur.trim().split(/\s+/).filter(Boolean);
    const upper = words.filter(isUpperCaseWord);
    const others = words.filter((word) => !isUpperCaseWord(word));
    if (upper.length > 0) {
      lastName = upper.join(" ");
      firstName = others.join(" ") || null;
    } else {
      lastName = words.join(" ") || null;
    }
  } else if (isRecord(demandeur)) {
    const text = (value: Json) => (typeof value === "string" && value.trim()) || null;
    lastName = text(demandeur.nom);
    firstName = text(demandeur.prenom) ?? text(demandeur.prenoms);
  }
  if (!lastName && !firstName) return null;
  return {
    id: 0,
    firstName,
    lastName,
    lastFirstName: null,
    firstLastName: null,
    legalPersonName: null,
    legalEntityName: null,
    legalEntityId: null,
    actorType: "NATURAL_PERSON",
  };
}

// Same shape as the source: a "NOM Prénom" string, or an object whose name
// fields are replaced.
function fakeDemandeur(source: Json, actor: Actor, scrubNames: NameScrubber): Json {
  const fake = anonymizeActor(actor);
  if (typeof source === "string") {
    return [actor.lastName && fake.lastName, actor.firstName && fake.firstName]
      .filter(Boolean)
      .join(" ");
  }
  const scrubbed = mapStrings(source, scrubNames) as Record<string, Json>;
  return {
    ...scrubbed,
    ...("nom" in scrubbed ? { nom: fake.lastName } : {}),
    ...("prenom" in scrubbed ? { prenom: fake.firstName } : {}),
    ...("prenoms" in scrubbed ? { prenoms: fake.firstName } : {}),
  };
}

function extractedDemandeur(rawResult: Json): Json {
  if (!isRecord(rawResult) || !isRecord(rawResult.extraction)) return undefined;
  const properties = rawResult.extraction.properties;
  if (!Array.isArray(properties)) return undefined;
  const property = properties.find((item) => isRecord(item) && item.name === DEMANDEUR);
  return isRecord(property) ? property.value : undefined;
}

// DocumentIA metadata and raw result stripped of personal data: the claimant is
// replaced by the fake name anonymizeActor() gives them, their name is scrubbed
// from every other text (decision grounds, classification explanation,
// anomalies…) and the barcodes (a 2D-Doc may encode an identity) are dropped.
// Field names and the other values are kept.
export function anonymizeDocumentIaResult<T extends { metadata?: Json; rawResult?: Json }>(
  outcome: T,
): T {
  const metadata = isRecord(outcome.metadata) ? outcome.metadata : undefined;
  const source = metadata?.[DEMANDEUR] ?? extractedDemandeur(outcome.rawResult);
  const actor = demandeurActor(source);
  const scrubNames = actor ? createNameScrubber([actor]) : KEEP_NAMES;
  const replaceDemandeur = (value: Json) =>
    actor && value != null
      ? fakeDemandeur(value, actor, scrubNames)
      : mapStrings(value, scrubNames);

  const result: T = { ...outcome };
  if (metadata) {
    const scrubbed = mapStrings(metadata, scrubNames) as Record<string, Json>;
    if (DEMANDEUR in metadata) scrubbed[DEMANDEUR] = replaceDemandeur(metadata[DEMANDEUR]);
    result.metadata = scrubbed;
  }
  if (isRecord(outcome.rawResult)) {
    const raw = mapStrings(outcome.rawResult, scrubNames) as Record<string, Json>;
    if ("barcodes" in raw) raw.barcodes = [];
    const properties = isRecord(raw.extraction) ? raw.extraction.properties : undefined;
    if (Array.isArray(properties)) {
      const original = (outcome.rawResult.extraction as Record<string, Json>).properties as Json[];
      properties.forEach((property, index) => {
        const before = original[index];
        if (!isRecord(property) || !isRecord(before) || before.name !== DEMANDEUR) return;
        property.value = replaceDemandeur(before.value);
        if (isRecord(property.anomaly) && isRecord(before.anomaly)) {
          property.anomaly.raw_value = replaceDemandeur(before.anomaly.raw_value);
        }
      });
    }
    result.rawResult = raw;
  }
  return result;
}
