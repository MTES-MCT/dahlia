import { LitigationType, RightType } from "@prisma/client";

// French labels for the user-managed classification enums of a case file.
// The option arrays keep the display order chosen for the edit form.

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

export const LITIGATION_TYPE_OPTIONS: { value: LitigationType; label: string }[] = [
  LitigationType.INDEMNITAIRE,
  LitigationType.REFERE,
  LitigationType.INJONCTION,
  LitigationType.EXCES_DE_POUVOIR,
].map((value) => ({ value, label: LITIGATION_TYPE_LABELS[value] }));

export const RIGHT_TYPE_OPTIONS: { value: RightType; label: string }[] = [
  RightType.LOGEMENT,
  RightType.HEBERGEMENT,
].map((value) => ({ value, label: RIGHT_TYPE_LABELS[value] }));

export function litigationTypeLabel(value: LitigationType | null | undefined): string | undefined {
  return value ? LITIGATION_TYPE_LABELS[value] : undefined;
}

export function rightTypeLabel(value: RightType | null | undefined): string | undefined {
  return value ? RIGHT_TYPE_LABELS[value] : undefined;
}
