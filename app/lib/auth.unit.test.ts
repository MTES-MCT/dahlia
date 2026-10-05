import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We avoid instantiating a real PrismaClient (and thus opening a Postgres
// connection) when importing auth.ts : prismaAdapter simply keeps the reference,
// an empty object is enough for this suite.
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

// getProconnectDiscovery caches the document at the module level. We therefore
// reimport the module freshly for each test to start with a fresh cache and keep
// the tests independent of their execution order.
async function freshAuthModule() {
  vi.resetModules();
  return import("./auth");
}

// A fresh Response per call: Better Auth reads discovery while initializing
// the generic OAuth provider, and a Response body can only be consumed once.
function mockDiscoveryFetch(body: string, status: number) {
  return vi.fn().mockImplementation(() => Promise.resolve(new Response(body, { status })));
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
    const fetchMock = mockDiscoveryFetch(JSON.stringify(discovery), 200);
    vi.stubGlobal("fetch", fetchMock);

    const { getProconnectDiscovery } = await freshAuthModule();
    const result = await getProconnectDiscovery();

    expect(result).toEqual(discovery);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/.well-known/openid-configuration"),
    );
  });

  it("met en cache le résultat : un seul appel réseau pour plusieurs lectures", async () => {
    const fetchMock = mockDiscoveryFetch(JSON.stringify({ issuer: "x" }), 200);
    vi.stubGlobal("fetch", fetchMock);

    const { auth, getProconnectDiscovery } = await freshAuthModule();
    // Plugin init also fetches discovery; wait for it before counting our calls.
    await auth.$context;
    const callsAfterAuthInit = fetchMock.mock.calls.length;
    await getProconnectDiscovery();
    await getProconnectDiscovery();

    expect(fetchMock.mock.calls.length - callsAfterAuthInit).toBe(1);
  });

  it("lève une erreur explicite quand la discovery répond un statut non-2xx", async () => {
    const fetchMock = mockDiscoveryFetch("nope", 503);
    vi.stubGlobal("fetch", fetchMock);

    const { getProconnectDiscovery } = await freshAuthModule();

    await expect(getProconnectDiscovery()).rejects.toThrow("503");
  });
});
