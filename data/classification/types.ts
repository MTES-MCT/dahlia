import type { LitigationType, RightType } from "@prisma/client";

// Fields a rule can be matched against. `title` is the only one filled today;
// `decision` is fed from the last decision reading (nature + operative part) so
// rules can already be written against it.
export const CLASSIFICATION_FIELDS = ["title", "decision"] as const;
export type ClassificationField = (typeof CLASSIFICATION_FIELDS)[number];

// Raw (non-normalized) text of each field for a single case file.
export type ClassificationInput = Partial<Record<ClassificationField, string | null | undefined>>;

// Attributes a rule can assign. Kept as a const array so the engine and the
// persistence layer iterate over exactly the same set.
export const CLASSIFICATION_ATTRIBUTES = ["litigationType", "rightType", "summary"] as const;
export type ClassificationAttribute = (typeof CLASSIFICATION_ATTRIBUTES)[number];

// Summary can be a constant label or derived from the regex match (capture
// groups), e.g. to distinguish "Référé liberté" from "Référé suspension".
export type SummaryResolver = (
  match: RegExpMatchArray,
  normalizedText: string,
) => string | undefined;

export interface ClassificationRule {
  id: string;
  // Why the rule exists / what it recognizes. Shown in --explain output.
  description: string;
  // Fields the rule looks at, in order. Defaults to all fields.
  fields?: readonly ClassificationField[];
  // Matched against the NORMALIZED field value (see normalize.ts): lower case,
  // no accents, punctuation collapsed to single spaces.
  pattern: RegExp;
  litigationType?: LitigationType;
  rightType?: RightType;
  summary?: string | SummaryResolver;
  // Raw sample values (as found in Telerecours) this rule must recognize.
  // Exercised by rules.unit.test.ts so the ruleset stays self-documenting.
  examples?: readonly string[];
}

export interface RuleMatch {
  ruleId: string;
  field: ClassificationField;
  // Attributes this rule actually set (an attribute already set by an earlier
  // rule is not overwritten, so it does not appear here).
  attributes: ClassificationAttribute[];
}

export interface ClassificationResult {
  litigationType?: LitigationType;
  rightType?: RightType;
  summary?: string;
  matches: RuleMatch[];
}
