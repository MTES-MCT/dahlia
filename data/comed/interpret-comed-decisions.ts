import type { Prisma, PrismaClient } from "@prisma/client";
import {
  COMED_DOCUMENT_TYPE,
  COMED_DOCUMENT_TYPES,
  DOCUMENT_IA_MAX_FILE_BYTES,
  DOCUMENT_IA_SUPPORTED_MIME_TYPES,
  flattenProperties,
  type DocumentIaClient,
  type DocumentIaExecution,
} from "../document-ia/client";
import type { TelerecoursClient } from "../telerecours/client.interface";
import { describeError, sleep } from "../telerecours/http";
import { caseFileKey, loadJurisdictionShortNames } from "./export-comed-files";
import { findComedDecisions, type ComedJurisdictionFilter } from "./find-comed-decisions";
import type { ComedDecision } from "./match-comed-decision";

const INTERPRETATION_LOOKUP_BATCH = 10_000;
const DEFAULT_RATE_LIMIT_MS = 150;

// Fields without which a COMED decision cannot be used (likely a verso, a
// partial scan or a cover letter): reported for manual review.
export const REQUIRED_COMED_FIELDS = ["numero_recours", "date_decision", "sens_decision"] as const;

export interface InterpretComedOptions {
  filter: ComedJurisdictionFilter;
  // Re-run DocumentIA even when the pièce already has a stored interpretation.
  force: boolean;
  documentIa: DocumentIaClient;
  // Télérecours client for a Dahlia jurisdiction short name (TA069, TA069bis…).
  getTelerecoursClient: (shortName: string) => TelerecoursClient;
  rateLimitMs?: number;
}

export interface InterpretComedStats {
  candidates: number;
  alreadyInterpreted: number;
  confirmed: number;
  notComed: number;
  incomplete: number;
  skipped: number;
  failed: number;
  // Case files with several confirmed COMED decisions (recto/verso, duplicates,
  // successive decisions): to be reviewed.
  multipleDecisionCaseFiles: number;
}

type InterpretationOutcome = Omit<
  Prisma.AttachedFileInterpretationUncheckedCreateInput,
  "jurisdictionCode" | "encodedFileId" | "workflowId"
>;

// Identify the file format from its first bytes: the Télérecours content-type
// header is not reliable enough (often application/octet-stream).
export function detectMimeType(data: Buffer, fallback?: string): string | undefined {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  return fallback?.split(";")[0]?.trim() || undefined;
}

// Reason why a file cannot be sent to DocumentIA, or null when it can.
export function unsupportedFileReason(data: Buffer, mimeType: string | undefined): string | null {
  if (!mimeType || !DOCUMENT_IA_SUPPORTED_MIME_TYPES.has(mimeType)) {
    return `Format non supporté par DocumentIA : ${mimeType ?? "inconnu"}`;
  }
  if (data.byteLength > DOCUMENT_IA_MAX_FILE_BYTES) {
    return `Fichier trop volumineux pour DocumentIA : ${data.byteLength} octets`;
  }
  return null;
}

// Map a DocumentIA execution to the stored row. workflow_metadata is dropped:
// in debug mode it holds the full OCR text and prompts (personal data).
export function interpretationFromExecution(execution: DocumentIaExecution): InterpretationOutcome {
  if (execution.status === "FAILED") {
    return {
      status: "FAILED",
      documentType: null,
      confidence: null,
      metadata: undefined,
      rawResult: undefined,
      errorMessage: execution.errorMessage,
      executionId: execution.executionId,
    };
  }
  const rawResult: Record<string, unknown> = { ...execution.result };
  delete rawResult.workflow_metadata;
  const classification = execution.result.classification ?? null;
  return {
    status: "SUCCESS",
    documentType: classification?.document_type ?? execution.result.extraction?.type ?? null,
    confidence: classification?.confidence ?? null,
    metadata: flattenProperties(execution.result.extraction?.properties) as Prisma.InputJsonObject,
    rawResult: rawResult as Prisma.InputJsonObject,
    errorMessage: null,
    executionId: execution.executionId,
  };
}

// Case-file scope of the standalone CLI: soft-deleted dossiers are always left
// out (their pièces can no longer be downloaded); "ongoing" also leaves out
// closed ones, like the scraper's --enrich ongoing.
export function comedCaseFileScope(
  enrich: "all" | "ongoing",
  closedStatusLabels: readonly string[],
): Prisma.CaseFileWhereInput {
  return {
    isDeleted: false,
    ...(enrich === "ongoing" ? { lastStatus: { label: { notIn: [...closedStatusLabels] } } } : {}),
  };
}

export function missingComedFields(metadata: unknown): string[] {
  const values = (metadata ?? {}) as Record<string, unknown>;
  return REQUIRED_COMED_FIELDS.filter((field) => values[field] == null || values[field] === "");
}

function interpretationKey(jurisdictionCode: string, encodedFileId: string): string {
  return `${jurisdictionCode}\0${encodedFileId}`;
}

// Pièces whose interpretation is final: SUCCESS (whatever the classification)
// or SKIPPED (the file will not change). FAILED rows are retried.
async function loadDoneInterpretations(
  prisma: PrismaClient,
  decisions: readonly ComedDecision[],
): Promise<Set<string>> {
  const idsByCourt = new Map<string, string[]>();
  for (const decision of decisions) {
    const ids = idsByCourt.get(decision.jurisdictionCode) ?? [];
    ids.push(decision.encodedFileId);
    idsByCourt.set(decision.jurisdictionCode, ids);
  }

  const done = new Set<string>();
  for (const [jurisdictionCode, ids] of idsByCourt) {
    for (let offset = 0; offset < ids.length; offset += INTERPRETATION_LOOKUP_BATCH) {
      const rows = await prisma.attachedFileInterpretation.findMany({
        where: {
          jurisdictionCode,
          encodedFileId: { in: ids.slice(offset, offset + INTERPRETATION_LOOKUP_BATCH) },
          status: { in: ["SUCCESS", "SKIPPED"] },
        },
        select: { jurisdictionCode: true, encodedFileId: true },
      });
      for (const row of rows) done.add(interpretationKey(row.jurisdictionCode, row.encodedFileId));
    }
  }
  return done;
}

async function saveInterpretation(
  prisma: PrismaClient,
  decision: ComedDecision,
  workflowId: string,
  outcome: InterpretationOutcome,
): Promise<void> {
  const key = {
    jurisdictionCode: decision.jurisdictionCode,
    encodedFileId: decision.encodedFileId,
  };
  const data = { ...outcome, workflowId };
  await prisma.attachedFileInterpretation.upsert({
    where: { jurisdictionCode_encodedFileId: key },
    create: { ...key, ...data },
    update: data,
  });
}

async function interpretOne(
  decision: ComedDecision,
  telerecours: TelerecoursClient,
  shortName: string,
  documentIa: DocumentIaClient,
): Promise<InterpretationOutcome> {
  const file = await telerecours.downloadFile(decision.encodedFileId, shortName);
  const mimeType = detectMimeType(file.data, file.mimeType);
  const reason = unsupportedFileReason(file.data, mimeType);
  if (reason) {
    return { status: "SKIPPED", errorMessage: reason };
  }
  const execution = await documentIa.interpret(
    { data: file.data, fileName: file.fileName ?? decision.fileName, mimeType: mimeType! },
    {
      documentTypes: COMED_DOCUMENT_TYPES,
      metadata: {
        source: "dahlia",
        jurisdictionCode: decision.jurisdictionCode,
        encodedFileId: decision.encodedFileId,
      },
    },
  );
  return interpretationFromExecution(execution);
}

// Find the COMED-decision candidates (by name, see match-comed-decision), send
// each one not yet interpreted to DocumentIA, and store the result in
// attached_file_interpretations.
export async function interpretComedDecisions(
  prisma: PrismaClient,
  options: InterpretComedOptions,
): Promise<InterpretComedStats> {
  const rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  const candidates = await findComedDecisions(prisma, options.filter);
  const done = options.force
    ? new Set<string>()
    : await loadDoneInterpretations(prisma, candidates);
  const todo = candidates.filter(
    (decision) => !done.has(interpretationKey(decision.jurisdictionCode, decision.encodedFileId)),
  );

  const stats: InterpretComedStats = {
    candidates: candidates.length,
    alreadyInterpreted: candidates.length - todo.length,
    confirmed: 0,
    notComed: 0,
    incomplete: 0,
    skipped: 0,
    failed: 0,
    multipleDecisionCaseFiles: 0,
  };
  console.log(
    `→ ${candidates.length} pièce(s) candidate(s), ${stats.alreadyInterpreted} déjà interprétée(s), ` +
      `${todo.length} à envoyer à DocumentIA${options.force ? " (--force-document-ia)" : ""}.`,
  );
  if (todo.length === 0) return stats;

  const shortNames = await loadJurisdictionShortNames(prisma, todo);
  const confirmedByCaseFile = new Map<string, number>();

  for (let index = 0; index < todo.length; index++) {
    const decision = todo[index]!;
    const key = caseFileKey(decision.jurisdictionCode, decision.caseFileNumber);
    const shortName = shortNames.get(key) ?? decision.jurisdictionCode;
    const label =
      `  [${index + 1}/${todo.length}] ${decision.jurisdictionCode} ${decision.caseFileNumber} ` +
      `${decision.fileName}`;

    let outcome: InterpretationOutcome;
    try {
      outcome = await interpretOne(
        decision,
        options.getTelerecoursClient(shortName),
        shortName,
        options.documentIa,
      );
    } catch (error) {
      outcome = { status: "FAILED", errorMessage: describeError(error) };
    }

    try {
      await saveInterpretation(prisma, decision, options.documentIa.workflowId, outcome);
    } catch (error) {
      stats.failed++;
      console.error(`${label} → échec d'enregistrement : ${describeError(error)}`);
      continue;
    }

    if (outcome.status === "SKIPPED") {
      stats.skipped++;
      console.warn(`${label} → ignorée : ${outcome.errorMessage}`);
    } else if (outcome.status === "FAILED") {
      stats.failed++;
      console.error(`${label} → échec : ${outcome.errorMessage}`);
    } else if (outcome.documentType === COMED_DOCUMENT_TYPE) {
      stats.confirmed++;
      confirmedByCaseFile.set(key, (confirmedByCaseFile.get(key) ?? 0) + 1);
      const missing = missingComedFields(outcome.metadata);
      if (missing.length > 0) {
        stats.incomplete++;
        console.warn(`${label} → décision COMED incomplète (manque : ${missing.join(", ")})`);
      } else {
        console.log(`${label} → décision COMED (confiance ${outcome.confidence ?? "?"})`);
      }
    } else {
      stats.notComed++;
      console.log(`${label} → pas une décision COMED (${outcome.documentType ?? "inconnu"})`);
    }

    if (index + 1 < todo.length && rateLimitMs > 0) await sleep(rateLimitMs);
  }

  stats.multipleDecisionCaseFiles = [...confirmedByCaseFile.values()].filter((n) => n > 1).length;
  return stats;
}

export function logInterpretComedStats(stats: InterpretComedStats): void {
  console.log("--------------------------------------------------");
  console.log("INTERPRÉTATION DOCUMENTIA DES DÉCISIONS COMED");
  console.log(
    `  - candidates : ${stats.candidates} (déjà interprétées : ${stats.alreadyInterpreted})`,
  );
  console.log(`  - confirmées : ${stats.confirmed} (dont incomplètes : ${stats.incomplete})`);
  console.log(`  - non COMED : ${stats.notComed}`);
  console.log(`  - ignorées (format/taille) : ${stats.skipped}`);
  console.log(`  - échecs (réessayées au prochain lancement) : ${stats.failed}`);
  console.log(
    `  - dossiers avec plusieurs décisions confirmées dans ce lancement : ${stats.multipleDecisionCaseFiles}`,
  );
  console.log("--------------------------------------------------");
}
