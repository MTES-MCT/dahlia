// Review state of the "Qualification du dossier" block.
//
// The classifier (data/cli/classify-case-files.ts) writes some qualification
// fields and logs each change in `classification_field_changes`. An agent must
// review those values: the block asks for it as long as a classifier change is
// more recent than the last validation.

// Fields of the block the classifier may write. `summary` is deprecated and no
// longer displayed, so its changes do not call for a review.
export const CLASSIFIER_QUALIFICATION_FIELDS = ["litigationType", "rightType"] as const;

export type ClassifierQualificationField = (typeof CLASSIFIER_QUALIFICATION_FIELDS)[number];

export type QualificationReviewState =
  // A classifier change is more recent than the last validation (or none yet).
  | "toReview"
  // Validated after the last classifier change. The validation date is only
  // stamped when a review was pending, so this always follows a real review.
  | "validated"
  // Never classified nor validated: nothing to review.
  | "notReviewed";

export function getQualificationReviewState(
  validatedAt: Date | null,
  lastClassifierChangeAt: Date | null,
): QualificationReviewState {
  if (lastClassifierChangeAt && (!validatedAt || validatedAt < lastClassifierChangeAt)) {
    return "toReview";
  }
  return validatedAt ? "validated" : "notReviewed";
}

// Latest classifier change per field, as loaded with the case file.
export type ClassifierFieldChange = { field: string; changedAt: Date };

// Fields whose classifier value was not reviewed yet: the block rule, applied
// field by field.
export function getFieldsToReview(
  validatedAt: Date | null,
  changes: ClassifierFieldChange[],
): ClassifierQualificationField[] {
  return CLASSIFIER_QUALIFICATION_FIELDS.filter((field) => {
    const change = changes.find((candidate) => candidate.field === field);
    return (
      change !== undefined &&
      getQualificationReviewState(validatedAt, change.changedAt) === "toReview"
    );
  });
}

// Most recent change among `changes`, or null.
export function getLastClassifierChangeAt(changes: ClassifierFieldChange[]): Date | null {
  return changes.reduce<Date | null>(
    (latest, change) => (!latest || change.changedAt > latest ? change.changedAt : latest),
    null,
  );
}
