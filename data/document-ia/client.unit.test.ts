import { describe, expect, it, vi } from "vitest";
import {
  createDocumentIaClient,
  documentIaConfigFromEnv,
  flattenProperties,
  type DocumentIaConfig,
} from "./client";

const config: DocumentIaConfig = {
  baseUrl: "http://localhost:8000",
  apiKey: "dia_test_key",
  workflowId: "document-classification-extraction-v2",
  pollIntervalMs: 1,
  timeoutMs: 1_000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const file = { data: Buffer.from("%PDF-1.4"), fileName: "comed.pdf", mimeType: "application/pdf" };

describe("documentIaConfigFromEnv", () => {
  it("requires the URL and the API key", () => {
    expect(() => documentIaConfigFromEnv({ DOCUMENT_IA_URL: "http://x" })).toThrow(
      /DOCUMENT_IA_API_KEY/,
    );
  });

  it("applies defaults and strips the trailing slash", () => {
    expect(
      documentIaConfigFromEnv({ DOCUMENT_IA_URL: "http://x/", DOCUMENT_IA_API_KEY: "k" }),
    ).toEqual({
      baseUrl: "http://x",
      apiKey: "k",
      workflowId: "document-classification-extraction-v2",
      pollIntervalMs: 2_000,
      timeoutMs: 300_000,
    });
  });
});

describe("flattenProperties", () => {
  it("maps properties to { name: value }, keeping strings typed as object", () => {
    expect(
      flattenProperties([
        { name: "numero_recours", type: "string", value: "2024-034-001185" },
        { name: "sens_decision", type: "object", value: "rejet" },
        { name: "motifs_recours", type: "list", value: ["Sans domicile"] },
        {
          name: "date_decision",
          type: "date",
          value: null,
          anomaly: { code: "x", raw_value: "y" },
        },
        {
          name: "demandeur",
          type: "object",
          value: [{ name: "nom", type: "string", value: "TALBI" }],
        },
      ]),
    ).toEqual({
      numero_recours: "2024-034-001185",
      sens_decision: "rejet",
      motifs_recours: ["Sans domicile"],
      date_decision: null,
      demandeur: { nom: "TALBI" },
    });
  });
});

describe("createDocumentIaClient", () => {
  it("starts the workflow with the classification override, then polls until SUCCESS", async () => {
    const result = { classification: { document_type: "decision_comed", confidence: 0.9 } };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { execution_id: "exec-1" } }))
      .mockResolvedValueOnce(jsonResponse({ id: "exec-1", status: "STARTED", data: {} }))
      .mockResolvedValueOnce(jsonResponse({ id: "exec-1", status: "SUCCESS", data: { result } }));

    const execution = await createDocumentIaClient(config, fetchImpl).interpret(file, {
      documentTypes: ["decision_comed"],
    });

    expect(execution).toEqual({ status: "SUCCESS", executionId: "exec-1", result });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "http://localhost:8000/api/v2/workflows/document-classification-extraction-v2/execute",
    );
    expect(init?.headers).toEqual({ "X-API-KEY": "dia_test_key" });
    const form = init?.body as FormData;
    expect(JSON.parse(form.get("override") as string)).toEqual({
      llm_classify_document: [{ param: "document_types", value: ["decision_comed"] }],
    });
    expect(fetchImpl.mock.calls[1]![0]).toBe("http://localhost:8000/api/v1/executions/exec-1");
  });

  it("returns FAILED with the DocumentIA error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { execution_id: "exec-2" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "exec-2",
          status: "FAILED",
          data: { error_type: "OcrError", error_message: "boom" },
        }),
      );

    await expect(
      createDocumentIaClient(config, fetchImpl).interpret(file, { documentTypes: ["decision_comed"] }),
    ).resolves.toEqual({ status: "FAILED", executionId: "exec-2", errorMessage: "OcrError: boom" });
  });

  it("throws on an HTTP error when starting the workflow", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid API key" }, 401));

    await expect(
      createDocumentIaClient(config, fetchImpl).interpret(file, { documentTypes: ["decision_comed"] }),
    ).rejects.toThrow(/401/);
  });

  it("gives up after the timeout", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { execution_id: "exec-3" } }))
      .mockImplementation(async () => jsonResponse({ id: "exec-3", status: "STARTED", data: {} }));

    const execution = await createDocumentIaClient(
      { ...config, timeoutMs: 5 },
      fetchImpl,
    ).interpret(file, { documentTypes: ["decision_comed"] });

    expect(execution).toMatchObject({
      status: "FAILED",
      errorMessage: expect.stringMatching(/Timeout/),
    });
  });
});
