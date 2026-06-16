"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { describeError, getTelerecoursCaseFileClient } from "@/data/telerecours-client";
import { enrichCaseFile } from "@/data/enrich-case-file";

// Default jurisdiction used when refreshing a case file from the UI.
const DEFAULT_JURISDICTION = "TA069";

export type RefreshCaseFileResult = { ok: true } | { ok: false; error: string };

// Re-fetch a single case file from Télérecours and upsert it into the database,
// reusing the same enrichment pipeline as the scraping script. The Télérecours
// client is a singleton per jurisdiction (see getTelerecoursCaseFileClient).
export async function refreshCaseFile(caseFileNumber: string): Promise<RefreshCaseFileResult> {
  try {
    const jurisdiction = DEFAULT_JURISDICTION;
    const username = process.env[`${jurisdiction}_TELERECOURS_USERNAME`];
    const password = process.env[`${jurisdiction}_TELERECOURS_PASSWORD`];
    if (!username || !password) {
      throw new Error(
        `Identifiants Télérecours manquants pour ${jurisdiction} ` +
          `(${jurisdiction}_TELERECOURS_USERNAME / _PASSWORD).`,
      );
    }

    const client = getTelerecoursCaseFileClient({ username, password });

    // Anonymize everywhere except in production, mirroring the scraping script.
    const anonymize = process.env.ENVIRONMENT !== "production";

    await enrichCaseFile(prisma, client, caseFileNumber, jurisdiction, anonymize);

    revalidatePath(`/case_files/${encodeURIComponent(caseFileNumber)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
