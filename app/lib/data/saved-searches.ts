import { prisma } from "@/app/lib/prisma";
import { getCurrentUserId } from "@/app/lib/case-file-scope";
import { resolveStatusGroup } from "@/app/lib/dashboard-filter";
import { type SavedSearchView } from "@/app/lib/saved-searches";

// Searches saved by the current user, sorted by name. Nobody else's searches
// are ever returned; no validated session means no search.
export async function fetchCurrentUserSavedSearches(): Promise<SavedSearchView[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, query: true, statusGroup: true },
  });
  return searches.map((search) => ({
    ...search,
    statusGroup: resolveStatusGroup(search.statusGroup),
  }));
}
