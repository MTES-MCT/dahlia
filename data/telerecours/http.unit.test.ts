import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_HOST,
  assertTelerecoursApiUrl,
  buildTelerecoursRequestUrl,
  describeError,
  encodeApiPathSegment,
  fetchWithRetry,
  parseContentDispositionFileName,
  telerecoursApiUrl,
} from "./http";

describe("describeError", () => {
  it("flattens a nested cause chain", () => {
    const inner = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const outer = new Error("fetch failed", { cause: inner });
    expect(describeError(outer)).toBe(
      "Error: fetch failed → caused by [ECONNRESET] socket hang up",
    );
  });
  it("stringifies non-Error values", () => {
    expect(describeError("boom")).toBe("boom");
  });
});

describe("parseContentDispositionFileName", () => {
  it("prefers the RFC 5987 filename* form", () => {
    expect(parseContentDispositionFileName("attachment; filename*=UTF-8''m%C3%A9moire.pdf")).toBe(
      "mémoire.pdf",
    );
  });
  it("falls back to the classic filename form", () => {
    expect(parseContentDispositionFileName('attachment; filename="memoire.pdf"')).toBe(
      "memoire.pdf",
    );
  });
  it("returns undefined when absent", () => {
    expect(parseContentDispositionFileName(null)).toBeUndefined();
  });
});

describe("telerecoursApiUrl", () => {
  it("builds an absolute URL from a relative path", () => {
    expect(telerecoursApiUrl("/api/case-file")).toBe(`${API_HOST}/api/case-file`);
  });

  it("rejects absolute URLs passed as paths", () => {
    expect(() => telerecoursApiUrl("https://evil.example/api")).toThrow(/relative API path/);
  });

  it("rejects disallowed path prefixes", () => {
    expect(() => telerecoursApiUrl("/api/admin/users")).toThrow(/Disallowed Télérecours API path/);
  });
});

describe("buildTelerecoursRequestUrl", () => {
  it("returns a URL object for the Télérecours host", () => {
    const url = buildTelerecoursRequestUrl("/api/case-file/ABC123");
    expect(url.hostname).toBe("administrations.telerecours.fr");
    expect(url.pathname).toBe("/api/case-file/ABC123");
  });
});

describe("encodeApiPathSegment", () => {
  it("rejects path separators and encodes safe values", () => {
    expect(() => encodeApiPathSegment("a/b")).toThrow(/path separators/);
    expect(encodeApiPathSegment("abc")).toBe("abc");
  });
});

describe("assertTelerecoursApiUrl", () => {
  it("accepts the Télérecours API host", () => {
    expect(assertTelerecoursApiUrl(`${API_HOST}/api/case-file`).href).toBe(
      `${API_HOST}/api/case-file`,
    );
  });

  it("rejects other hosts", () => {
    expect(() => assertTelerecoursApiUrl("https://evil.example/api")).toThrow(/Disallowed/);
  });

  it("rejects non-HTTPS schemes", () => {
    expect(() => assertTelerecoursApiUrl("http://administrations.telerecours.fr/api")).toThrow(
      /Disallowed/,
    );
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the response on success", async () => {
    const ok = new Response("ok", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
    const res = await fetchWithRetry("/api/case-file", "token", "TA069");
    expect(res.status).toBe(200);
  });

  it("throws AuthenticationError on 401 (to trigger re-login upstream)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
    await expect(fetchWithRetry("/api/case-file", "token", "TA069")).rejects.toMatchObject({
      name: "AuthenticationError",
    });
  });

  it("retries on 500 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await fetchWithRetry("/api/case-file", "token", "TA069");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15000);

  it("rejects forged absolute URLs before calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithRetry("https://evil.example/api", "token", "TA069")).rejects.toThrow(
      /relative API path/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
