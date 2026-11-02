import { TELERECOURS_SYNC_RATE_LIMIT_POINTS } from "@/app/lib/telerecours-sync-rate-limiter";

// One ZIP request must not fan out into unbounded Télérecours calls or hold
// every file in memory before compression. Align with the per-minute budget so
// a single archive cannot exhaust it alone.
export const PIECE_BULK_DOWNLOAD_MAX_COUNT = TELERECOURS_SYNC_RATE_LIMIT_POINTS;

export function normalizePieceDownloadIds(rawIds: string[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of rawIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
