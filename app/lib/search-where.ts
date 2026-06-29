// Shared Prisma WHERE helpers for server-side table search (dashboard, pièces,
// historique). Mirrors the server-side search semantics used by the dashboard.

export function facetSearchWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function buildWordAndFilter<T>(
  words: string[],
  buildContains: (word: string) => T,
): T {
  if (words.length <= 1) {
    return buildContains(words[0] ?? "");
  }
  return { AND: words.map(buildContains) } as unknown as T;
}

export function combineAnd<T>(conditions: T[]): T {
  if (conditions.length === 0) return {} as T;
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions } as unknown as T;
}
