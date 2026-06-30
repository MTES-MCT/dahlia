import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { auth, getProconnectDiscovery } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

vi.mock("@/app/lib/auth", () => ({
  auth: { api: { getSession: vi.fn(), signOut: vi.fn() } },
  getProconnectDiscovery: vi.fn(),
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: { account: { findFirst: vi.fn() } },
}));

import { headers } from "next/headers";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockedHeaders = vi.mocked(headers);
const mockedGetSession = vi.mocked(auth.api.getSession);
const mockedSignOut = vi.mocked(auth.api.signOut);
const mockedFindFirst = vi.mocked(prisma.account.findFirst);
const mockedDiscovery = vi.mocked(getProconnectDiscovery);

// signOut renvoie une Response porteuse du cookie d'invalidation de session ;
// la route doit le propager sur sa propre réponse de redirection.
function signOutResponseWithCookie(cookie = "better-auth.session_token=; Max-Age=0") {
  return new Response(null, { headers: { "set-cookie": cookie } }) as never;
}

const request = new Request("https://dahlia.example/api/auth/proconnect-logout");

describe("GET /api/auth/proconnect-logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHeaders.mockResolvedValue(new Headers());
    delete process.env.BETTER_AUTH_URL;
  });

  it("ignore une requête de prefetch sans déconnecter (204)", async () => {
    mockedHeaders.mockResolvedValue(new Headers({ "next-router-prefetch": "1" }));

    const response = await GET(request);

    expect(response.status).toBe(204);
    // Un prefetch ne doit jamais invalider la session.
    expect(mockedSignOut).not.toHaveBeenCalled();
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("ignore aussi un prefetch signalé via Sec-Purpose", async () => {
    mockedHeaders.mockResolvedValue(new Headers({ "sec-purpose": "prefetch;prerender" }));

    const response = await GET(request);

    expect(response.status).toBe(204);
    expect(mockedSignOut).not.toHaveBeenCalled();
  });

  it("redirige vers l’accueil et propage le cookie de déconnexion quand aucune session", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    mockedSignOut.mockResolvedValue(signOutResponseWithCookie());

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dahlia.example/");
    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token=");
    // Pas de session → on ne va pas chercher de compte ni la discovery ProConnect.
    expect(mockedFindFirst).not.toHaveBeenCalled();
    expect(mockedDiscovery).not.toHaveBeenCalled();
  });

  it("redirige vers l’accueil quand la session n’a pas d’id_token stocké", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindFirst.mockResolvedValue(null as never);
    mockedSignOut.mockResolvedValue(signOutResponseWithCookie());

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dahlia.example/");
    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", providerId: "proconnect" },
      orderBy: { updatedAt: "desc" },
    });
    expect(mockedDiscovery).not.toHaveBeenCalled();
  });

  it("redirige vers l’end_session_endpoint ProConnect avec id_token_hint quand un id_token existe", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedFindFirst.mockResolvedValue({ idToken: "the-id-token" } as never);
    mockedSignOut.mockResolvedValue(signOutResponseWithCookie());
    mockedDiscovery.mockResolvedValue({
      end_session_endpoint: "https://fca.example/api/v2/session/end",
    } as never);

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://fca.example/api/v2/session/end");
    expect(location.searchParams.get("id_token_hint")).toBe("the-id-token");
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe("https://dahlia.example/");
    expect(location.searchParams.get("state")).toBeTruthy();
    // Le cookie d'invalidation de session doit aussi accompagner cette redirection.
    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token=");
  });

  it("utilise BETTER_AUTH_URL plutôt que l’origine de la requête quand il est défini", async () => {
    process.env.BETTER_AUTH_URL = "https://app.dahlia.gouv.fr";
    mockedGetSession.mockResolvedValue(null as never);
    mockedSignOut.mockResolvedValue(signOutResponseWithCookie());

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://app.dahlia.gouv.fr/");
  });
});
