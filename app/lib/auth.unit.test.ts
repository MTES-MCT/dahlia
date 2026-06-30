import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We avoid instantiating a real PrismaClient (and thus opening a Postgres
// connection) when importing auth.ts : prismaAdapter simply keeps the reference,
// an empty object is enough for this suite.
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

// getProconnectDiscovery caches the document at the module level. We therefore
// reimport the module freshly for each test to start with a fresh cache and keep
// the tests independent of their execution order.
async function freshGetProconnectDiscovery() {
  vi.resetModules();
  const mod = await import("./auth");
  return mod.getProconnectDiscovery;
}

describe("getProconnectDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("récupère le document de discovery via l’URL OIDC bien connue", async () => {
    const discovery = { issuer: "https://fca.example/api/v2" };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(discovery), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();
    const result = await getProconnectDiscovery();

    expect(result).toEqual(discovery);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/.well-known/openid-configuration"),
    );
  });

  it("met en cache le résultat : un seul appel réseau pour plusieurs lectures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ issuer: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();
    await getProconnectDiscovery();
    await getProconnectDiscovery();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("lève une erreur explicite quand la discovery répond un statut non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();

    await expect(getProconnectDiscovery()).rejects.toThrow("503");
  });
});
