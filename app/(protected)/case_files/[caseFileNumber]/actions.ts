"use server";

import { revalidatePath } from "next/cache";
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
