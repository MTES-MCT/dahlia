"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/app/lib/case-file-scope";
import { STATUS_GROUPS, type StatusGroup } from "@/app/lib/dashboard-filter";
import {
  describePrismaError,
  parsePositiveIntField,
  parseRequiredText,
} from "@/app/lib/form-actions";
import { prisma } from "@/app/lib/prisma";
import { SAVED_SEARCH_NAME_MAX_LENGTH } from "@/app/lib/saved-searches";

export type SavedSearchMutationResult = { ok: true } | { ok: false; error: string };

const DASHBOARD_PATH = "/case_files";
const UNAUTHENTICATED_ERROR = "Vous devez être connecté pour gérer vos recherches.";

const SAVED_SEARCH_PRISMA_ERRORS = {
  P2002: "Vous avez déjà une recherche portant ce nom.",
};

function isStatusGroup(value: string): value is StatusGroup {
  return (STATUS_GROUPS as readonly string[]).includes(value);
}

// Save the dashboard search (`query` + `statusGroup` tab) under `name` for the
// current user.
export async function saveSearchFormAction(
  _prevState: SavedSearchMutationResult | null,
  formData: FormData,
): Promise<SavedSearchMutationResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHENTICATED_ERROR };

  const parsedName = parseRequiredText(formData, "name", "Saisissez un nom pour la recherche.");
  if (!parsedName.ok) return parsedName;
  if (parsedName.value.length > SAVED_SEARCH_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Le nom ne doit pas dépasser ${SAVED_SEARCH_NAME_MAX_LENGTH} caractères.`,
    };
  }

  const parsedQuery = parseRequiredText(
    formData,
    "query",
    "Saisissez d’abord une recherche pour pouvoir la sauvegarder.",
  );
  if (!parsedQuery.ok) return parsedQuery;

  const statusGroup = String(formData.get("statusGroup") ?? "");
  if (!isStatusGroup(statusGroup)) {
    return { ok: false, error: "Catégorie de dossiers invalide." };
  }

  try {
    await prisma.savedSearch.create({
      data: { userId, name: parsedName.value, query: parsedQuery.value, statusGroup },
    });
    revalidatePath(DASHBOARD_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describePrismaError(error, SAVED_SEARCH_PRISMA_ERRORS) };
  }
}

// Delete one of the current user's saved searches. The owner is part of the
// filter, so another user's search behaves like a missing one.
export async function deleteSavedSearchFormAction(
  _prevState: SavedSearchMutationResult | null,
  formData: FormData,
): Promise<SavedSearchMutationResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHENTICATED_ERROR };

  const parsedId = parsePositiveIntField(formData, "id", "Identifiant de recherche manquant.");
  if (!parsedId.ok) return parsedId;

  try {
    const { count } = await prisma.savedSearch.deleteMany({
      where: { id: parsedId.value, userId },
    });
    if (count === 0) return { ok: false, error: "Recherche introuvable." };
    revalidatePath(DASHBOARD_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describePrismaError(error) };
  }
}
