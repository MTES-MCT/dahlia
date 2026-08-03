"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminMutationResult,
  describePrismaError,
  parsePositiveIntField,
  parseRequiredText,
  withAdminAction,
} from "@/app/lib/admin-actions";
import { prisma } from "@/app/lib/prisma";

export type DivisionMutationResult = AdminMutationResult;

const ADMIN_DIVISIONS_PATH = "/admin/divisions";

// Admins may only rename a division (display name). shortName comes from
// Télérecours and must never be changed from the UI.
export const updateDivisionFormAction = withAdminAction(
  async (_admin, _prevState: DivisionMutationResult | null, formData: FormData) => {
    const parsedId = parsePositiveIntField(formData, "id", "Identifiant de division manquant.");
    if (!parsedId.ok) return parsedId;

    const parsedName = parseRequiredText(formData, "name", "Le nom est obligatoire.");
    if (!parsedName.ok) return parsedName;

    try {
      await prisma.legalEntityDivision.update({
        where: { id: parsedId.value },
        data: { name: parsedName.value },
      });
      revalidatePath(ADMIN_DIVISIONS_PATH);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: describePrismaError(error, { P2025: "Division introuvable." }),
      };
    }
  },
);
