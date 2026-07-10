import type { LitigationType, RightType } from "@prisma/client";

// French labels for the user-managed classification enums of a case file.
// The option arrays keep the display order chosen for the edit form.
// Enum values are inlined here (not imported from @prisma/client) so this module
// stays safe to import from Client Components.

export const LITIGATION_TYPE_LABELS: Record<LitigationType, string> = {
  INDEMNITAIRE: "Recours indemnitaire",
  REFERE: "Référé",
  INJONCTION: "Recours injonction",
  EXCES_DE_POUVOIR: "Recours en excès de pouvoir",
};

export const RIGHT_TYPE_LABELS: Record<RightType, string> = {
  LOGEMENT: "Logement",
  HEBERGEMENT: "Hébergement",
};

const LITIGATION_TYPE_ORDER = [
  "INDEMNITAIRE",
  "REFERE",
  "INJONCTION",
  "EXCES_DE_POUVOIR",
] as const satisfies readonly LitigationType[];

const RIGHT_TYPE_ORDER = ["LOGEMENT", "HEBERGEMENT"] as const satisfies readonly RightType[];

export const LITIGATION_TYPE_OPTIONS: { value: LitigationType; label: string }[] =
  LITIGATION_TYPE_ORDER.map((value) => ({ value, label: LITIGATION_TYPE_LABELS[value] }));

export const RIGHT_TYPE_OPTIONS: { value: RightType; label: string }[] = RIGHT_TYPE_ORDER.map(
  (value) => ({ value, label: RIGHT_TYPE_LABELS[value] }),
);

export function litigationTypeLabel(value: LitigationType | null | undefined): string | undefined {
  return value ? LITIGATION_TYPE_LABELS[value] : undefined;
}

export function rightTypeLabel(value: RightType | null | undefined): string | undefined {
  return value ? RIGHT_TYPE_LABELS[value] : undefined;
}
