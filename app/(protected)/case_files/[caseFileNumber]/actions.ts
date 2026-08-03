"use server";

import { revalidatePath } from "next/cache";
import { LitigationType, RightType } from "@prisma/client";
import type { ProductionDeadlineType } from "@prisma/client";
import { PRODUCTION_DEADLINE_TYPE_VALUES } from "@/app/lib/case-file-enums";
import { prisma } from "@/app/lib/prisma";
import { describeError } from "@/data/telerecours/http";
import { getTelerecoursClient } from "@/app/lib/telerecours";
import { enrichCaseFile } from "@/data/persistence/enrich-case-file";

export type RefreshCaseFileResult = { ok: true } | { ok: false; error: string };

// Re-fetch a single case file from Télérecours and upsert it into the database,
// reusing the same enrichment pipeline as the scraping script. The Télérecours
// client is a singleton per jurisdiction (see getTelerecoursCaseFileClient).
export async function refreshCaseFile(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  try {
    const { client, jurisdiction } = getTelerecoursClient();

    // Anonymize everywhere except in production, mirroring the scraping script.
    const anonymize = process.env.ENVIRONMENT !== "production";

    await enrichCaseFile(prisma, client, caseFileNumber, jurisdiction, anonymize);

    revalidatePath(`/case_files/${encodeURIComponent(caseFileNumber)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export type UpdateCaseFileDetailsResult = { ok: true } | { ok: false; error: string };

// Resolve a raw form value to an enum member, or null when empty/invalid.
function parseEnumValue<T extends Record<string, string>>(
  enumObject: T,
  raw: string,
): { value: T[keyof T] | null; invalid: boolean } {
  if (!raw) {
    return { value: null, invalid: false };
  }
  if (Object.values(enumObject).includes(raw)) {
    return { value: raw as T[keyof T], invalid: false };
  }
  return { value: null, invalid: true };
}

function parseAllowedValue<T extends string>(
  allowed: readonly T[],
  raw: string,
): { value: T | null; invalid: boolean } {
  if (!raw) {
    return { value: null, invalid: false };
  }
  if (allowed.includes(raw as T)) {
    return { value: raw as T, invalid: false };
  }
  return { value: null, invalid: true };
}

function parseProductionDeadlineDate(raw: string): Date | null | "invalid" {
  if (!raw) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    return "invalid";
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "invalid";
  }
  return date;
}

// Persist the user-managed classification fields of a case file (type de
// contentieux, type de droit, raison/summary) edited from the details card.
export async function updateCaseFileDetailsFormAction(
  _prevState: UpdateCaseFileDetailsResult | null,
  formData: FormData,
): Promise<UpdateCaseFileDetailsResult> {
  const caseFileNumber = String(formData.get("caseFileNumber") ?? "").trim();
  if (!caseFileNumber) {
    return { ok: false, error: "Numéro de dossier manquant." };
  }

  const litigation = parseEnumValue(
    LitigationType,
    String(formData.get("litigationType") ?? "").trim(),
  );
  if (litigation.invalid) {
    return { ok: false, error: "Type de contentieux invalide." };
  }
  const right = parseEnumValue(RightType, String(formData.get("rightType") ?? "").trim());
  if (right.invalid) {
    return { ok: false, error: "Type de droit invalide." };
  }
  const summary = String(formData.get("summary") ?? "").trim();

  const hasProductionDeadlineFields = formData.get("hasProductionDeadlineFields") === "true";
  let productionDeadlineType: ProductionDeadlineType | null = null;
  let productionDeadlineDate: Date | null = null;

  if (hasProductionDeadlineFields) {
    const deadlineType = parseAllowedValue(
      PRODUCTION_DEADLINE_TYPE_VALUES,
      String(formData.get("productionDeadlineType") ?? "").trim(),
    );
    if (deadlineType.invalid) {
      return { ok: false, error: "Type d'échéance à produire invalide." };
    }
    productionDeadlineType = deadlineType.value;

    if (productionDeadlineType) {
      const rawProductionDeadlineDate = String(formData.get("productionDeadlineDate") ?? "").trim();
      const parsedDate = parseProductionDeadlineDate(rawProductionDeadlineDate);
      if (parsedDate === "invalid") {
        return { ok: false, error: "Date limite de production invalide." };
      }
      if (!parsedDate) {
        return { ok: false, error: "Date limite de production requise." };
      }
      productionDeadlineDate = parsedDate;
    }
  }

  try {
    await prisma.caseFile.update({
      where: { caseFileNumber },
      data: {
        litigationType: litigation.value,
        rightType: right.value,
        summary: summary || null,
        ...(hasProductionDeadlineFields
          ? {
              productionDeadlineType,
              productionDeadlineDate,
            }
          : {}),
      },
    });

    revalidatePath(`/case_files/${encodeURIComponent(caseFileNumber)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
