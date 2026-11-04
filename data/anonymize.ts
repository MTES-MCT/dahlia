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
