"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminMutationResult,
  describePrismaError,
  parsePositiveIntField,
  parseRequiredText,
  requireAdmin,
} from "@/app/lib/admin-actions";
import { prisma } from "@/app/lib/prisma";

export type JurisdictionMutationResult = AdminMutationResult;

const ADMIN_JURISDICTION_PATH = "/admin/jurisdiction";

// Admins may only rename a jurisdiction (display name). shortName is the
// Telerecours code and must never be changed from the UI.
export async function updateJurisdictionFormAction(
  _prevState: JurisdictionMutationResult | null,
  formData: FormData,
): Promise<JurisdictionMutationResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsedId = parsePositiveIntField(
    formData,
    "id",
    "Identifiant de juridiction manquant.",
  );
  if (!parsedId.ok) return parsedId;

  const parsedName = parseRequiredText(formData, "name", "Le nom est obligatoire.");
  if (!parsedName.ok) return parsedName;

  try {
    await prisma.jurisdiction.update({
      where: { id: parsedId.value },
      data: { name: parsedName.value },
    });
    revalidatePath(ADMIN_JURISDICTION_PATH);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: describePrismaError(error, { P2025: "Juridiction introuvable." }),
    };
  }
}
