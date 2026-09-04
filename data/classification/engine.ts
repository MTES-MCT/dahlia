import {
  CLASSIFICATION_FIELDS,
  type ClassificationField,
  type ClassificationInput,
  type ClassificationResult,
  type ClassificationRule,
  type ClassificationAttribute,
} from "./types";
import { normalizeText } from "./normalize";
import { DEFAULT_RULES } from "./rules";

function resolveSummary(
  rule: ClassificationRule,
  match: RegExpMatchArray,
  normalizedText: string,
): string | undefined {
  if (typeof rule.summary === "function") return rule.summary(match, normalizedText);
  return rule.summary;
}

// Run the ruleset over one case file. Rules are evaluated in declaration order
// and the FIRST rule providing a given attribute wins: put the most specific
// rules first. A rule that matches but whose attributes are all already set
// contributes nothing (and is not reported as a match).
export function classify(
  input: ClassificationInput,
  rules: readonly ClassificationRule[] = DEFAULT_RULES,
): ClassificationResult {
  const normalized = new Map<ClassificationField, string>();
  for (const field of CLASSIFICATION_FIELDS) {
    const text = normalizeText(input[field]);
    if (text) normalized.set(field, text);
  }

  const result: ClassificationResult = { matches: [] };

  for (const rule of rules) {
    for (const field of rule.fields ?? CLASSIFICATION_FIELDS) {
      const text = normalized.get(field);
      if (!text) continue;
      const match = text.match(rule.pattern);
      if (!match) continue;

      const attributes: ClassificationAttribute[] = [];
      if (rule.litigationType && result.litigationType === undefined) {
        result.litigationType = rule.litigationType;
        attributes.push("litigationType");
      }
      if (rule.rightType && result.rightType === undefined) {
        result.rightType = rule.rightType;
        attributes.push("rightType");
      }
      if (rule.summary !== undefined && result.summary === undefined) {
        const summary = resolveSummary(rule, match, text);
        if (summary) {
          result.summary = summary;
          attributes.push("summary");
        }
      }
      if (attributes.length > 0) {
        result.matches.push({ ruleId: rule.id, field, attributes });
      }
      // A rule is applied at most once, on the first field it matches.
      break;
    }
  }

  return result;
}

// True when the ruleset produced at least one attribute.
export function hasClassification(result: ClassificationResult): boolean {
  return (
    result.litigationType !== undefined ||
    result.rightType !== undefined ||
    result.summary !== undefined
  );
}
