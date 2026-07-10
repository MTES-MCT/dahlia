import type { LitigationType, RightType } from "@prisma/client";

// French labels for the user-managed classification enums of a case file.
// The option arrays keep the display order chosen for the edit form.
// Enum values are inlined here (not imported from @prisma/client) so this module
// stays safe to import from Client Components.

export const LITIGATION_TYPE_LABELS: Record<LitigationType, string> = {
  LIQUIDATION_ASTREINTE: "Liquidation d'astreinte",
  INJONCTION: "Recours injonction",
  INDEMNITAIRE: "Recours indemnitaire",
  EXCES_DE_POUVOIR: "Recours en excès de pouvoir (REP)",
  REFERE: "Référé",
};

export const RIGHT_TYPE_LABELS: Record<RightType, string> = {
  LOGEMENT: "Logement",
  HEBERGEMENT: "Hébergement",
};

// Empty string is the form value for an unset right type (stored as null in the database).
export const RIGHT_TYPE_UNDEFINED_VALUE = "" as const;
export const RIGHT_TYPE_UNDEFINED_LABEL = "Non défini";

export type RightTypeFormValue = RightType | typeof RIGHT_TYPE_UNDEFINED_VALUE;

const LITIGATION_TYPE_ORDER = [
  "LIQUIDATION_ASTREINTE",
  "INJONCTION",
  "INDEMNITAIRE",
  "EXCES_DE_POUVOIR",
  "REFERE",
] as const satisfies readonly LitigationType[];

const RIGHT_TYPE_ORDER = [
  RIGHT_TYPE_UNDEFINED_VALUE,
  "LOGEMENT",
  "HEBERGEMENT",
] as const satisfies readonly RightTypeFormValue[];

export const LITIGATION_TYPE_OPTIONS: { value: LitigationType; label: string }[] =
  LITIGATION_TYPE_ORDER.map((value) => ({ value, label: LITIGATION_TYPE_LABELS[value] }));

export const RIGHT_TYPE_OPTIONS: { value: RightTypeFormValue; label: string }[] =
  RIGHT_TYPE_ORDER.map((value) => ({
    value,
    label: value === RIGHT_TYPE_UNDEFINED_VALUE ? RIGHT_TYPE_UNDEFINED_LABEL : RIGHT_TYPE_LABELS[value],
  }));

export function litigationTypeLabel(value: LitigationType | null | undefined): string | undefined {
  return value ? LITIGATION_TYPE_LABELS[value] : undefined;
}

export function rightTypeLabel(value: RightType | null | undefined): string | undefined {
  return value ? RIGHT_TYPE_LABELS[value] : RIGHT_TYPE_UNDEFINED_LABEL;
}
