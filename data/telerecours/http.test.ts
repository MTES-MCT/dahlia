import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, fetchWithRetry, parseContentDispositionFileName } from "./http";

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

describe("fetchWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the response on success", async () => {
    const ok = new Response("ok", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
    const res = await fetchWithRetry("https://x/api", "token", "TA069");
    expect(res.status).toBe(200);
  });

  it("throws AuthenticationError on 401 (to trigger re-login upstream)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
    await expect(fetchWithRetry("https://x/api", "token", "TA069")).rejects.toMatchObject({
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

    const res = await fetchWithRetry("https://x/api", "token", "TA069");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15000);
});
