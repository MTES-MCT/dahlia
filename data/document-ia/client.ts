import { sleep } from "../telerecours/http";

// Minimal client for the DocumentIA API (v2 workflows + v1 execution status).
// The workflow is started asynchronously, then polled: execute-sync is bounded
// by a server-side timeout that OCR + LLM on a scanned decision can exceed.

export const DEFAULT_DOCUMENT_IA_WORKFLOW_ID = "document-classification-extraction-v2";
// Restricting the classifier to the expected type turns the classification
// into a yes/no confirmation that the pièce is a COMED decision. "autre" is
// always added by the DocumentIA prompt and must NOT be passed explicitly:
// the classify step then fails with UnsupportedDocumentType (AUTRE).
export const COMED_DOCUMENT_TYPES = ["decision_comed"] as const;
export const COMED_DOCUMENT_TYPE = "decision_comed";

// Limits of the DocumentIA workflow (workflows.yaml: supported_file_types, max_file_size_mb).
export const DOCUMENT_IA_SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
export const DOCUMENT_IA_MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface DocumentIaConfig {
  baseUrl: string;
  apiKey: string;
  workflowId: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

export function documentIaConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): DocumentIaConfig {
  const baseUrl = env.DOCUMENT_IA_URL;
  const apiKey = env.DOCUMENT_IA_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Configuration DocumentIA manquante : DOCUMENT_IA_URL et DOCUMENT_IA_API_KEY sont requis.",
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    workflowId: env.DOCUMENT_IA_WORKFLOW_ID || DEFAULT_DOCUMENT_IA_WORKFLOW_ID,
    pollIntervalMs: positiveInt(env.DOCUMENT_IA_POLL_INTERVAL_MS, 2_000),
    timeoutMs: positiveInt(env.DOCUMENT_IA_TIMEOUT_MS, 5 * 60_000),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Subset of the DocumentIA SuccessResult used by Dahlia; the full payload is
// stored as-is in rawResult.
export interface DocumentIaProperty {
  name: string;
  type: string;
  value: unknown;
  anomaly?: { code: string; raw_value: string } | null;
}

export interface DocumentIaResult {
  classification?: { document_type: string; confidence: number; explanation: string } | null;
  extraction?: { type: string; properties?: DocumentIaProperty[] } | null;
  [key: string]: unknown;
}

export type DocumentIaExecution =
  | { status: "SUCCESS"; executionId: string; result: DocumentIaResult }
  | { status: "FAILED"; executionId: string | null; errorMessage: string };

export interface DocumentIaFile {
  data: Buffer;
  fileName: string;
  mimeType: string;
}

export interface DocumentIaClient {
  readonly workflowId: string;
  interpret(
    file: DocumentIaFile,
    options: { documentTypes: readonly string[]; metadata?: Record<string, string> },
  ): Promise<DocumentIaExecution>;
}

type FetchLike = typeof fetch;

export function createDocumentIaClient(
  config: DocumentIaConfig,
  fetchImpl: FetchLike = fetch,
): DocumentIaClient {
  const headers = { "X-API-KEY": config.apiKey };

  async function startExecution(
    file: DocumentIaFile,
    options: { documentTypes: readonly string[]; metadata?: Record<string, string> },
  ): Promise<string> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(file.data)], { type: file.mimeType }),
      file.fileName,
    );
    form.append(
      "override",
      JSON.stringify({
        llm_classify_document: [{ param: "document_types", value: [...options.documentTypes] }],
      }),
    );
    if (options.metadata) form.append("metadata", JSON.stringify(options.metadata));

    const url = `${config.baseUrl}/api/v2/workflows/${encodeURIComponent(config.workflowId)}/execute`;
    const response = await fetchImpl(url, { method: "POST", headers, body: form });
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(`POST ${url} → ${response.status} ${describeBody(body)}`);
    }
    const executionId = (body as { data?: { execution_id?: unknown } })?.data?.execution_id;
    if (typeof executionId !== "string") {
      throw new Error(`POST ${url} → réponse sans execution_id`);
    }
    return executionId;
  }

  async function waitForExecution(executionId: string): Promise<DocumentIaExecution> {
    const url = `${config.baseUrl}/api/v1/executions/${encodeURIComponent(executionId)}`;
    const deadline = Date.now() + config.timeoutMs;
    for (;;) {
      const response = await fetchImpl(url, { headers });
      const body = (await readJson(response)) as {
        status?: string;
        data?: { result?: DocumentIaResult; error_message?: string; error_type?: string };
      } | null;
      if (!response.ok) {
        throw new Error(`GET ${url} → ${response.status} ${describeBody(body)}`);
      }
      if (body?.status === "SUCCESS") {
        return { status: "SUCCESS", executionId, result: body.data?.result ?? {} };
      }
      if (body?.status === "FAILED") {
        const type = body.data?.error_type ? `${body.data.error_type}: ` : "";
        return {
          status: "FAILED",
          executionId,
          errorMessage: `${type}${body.data?.error_message ?? "échec DocumentIA"}`,
        };
      }
      if (Date.now() >= deadline) {
        return {
          status: "FAILED",
          executionId,
          errorMessage: `Timeout : exécution toujours en cours après ${config.timeoutMs} ms`,
        };
      }
      await sleep(config.pollIntervalMs);
    }
  }

  return {
    workflowId: config.workflowId,
    async interpret(file, options) {
      const executionId = await startExecution(file, options);
      return waitForExecution(executionId);
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeBody(body: unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return (text ?? "").slice(0, 500);
}

// Extracted properties as { name: value }. Nested object properties (e.g.
// identity) are flattened recursively into plain objects.
export function flattenProperties(
  properties: readonly DocumentIaProperty[] | undefined,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const property of properties ?? []) {
    flat[property.name] = flattenValue(property);
  }
  return flat;
}

function flattenValue(property: DocumentIaProperty): unknown {
  const { value } = property;
  if (
    property.type === "object" &&
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && "name" in item)
  ) {
    return flattenProperties(value as DocumentIaProperty[]);
  }
  return value;
}
