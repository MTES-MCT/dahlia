import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "jwks"),
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from "jose";
import { fillMissingUserNamesFromProvider } from "./proconnect-user";

const mockedJwtVerify = vi.mocked(jwtVerify);

function stubProconnectApis(profile: {
  sub: string;
  email?: string;
  given_name?: string;
  usual_name?: string;
}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("openid-configuration")) {
      return new Response(
        JSON.stringify({
          issuer: "https://fca.example/api/v2",
          userinfo_endpoint: "https://fca.example/api/v2/userinfo",
          jwks_uri: "https://fca.example/api/v2/jwks",
          end_session_endpoint: "https://fca.example/api/v2/logout",
        }),
        { status: 200 },
      );
    }
    return new Response("fake.jwt", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  mockedJwtVerify.mockResolvedValue({ payload: profile } as never);
}

describe("fillMissingUserNamesFromProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne fait rien si le provider n'est pas ProConnect ou sans access token", async () => {
    await fillMissingUserNamesFromProvider({
      userId: "u1",
      providerId: "other",
      accessToken: "token",
    });
    await fillMissingUserNamesFromProvider({
      userId: "u1",
      providerId: "proconnect",
      accessToken: null,
    });

    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("ne fait rien si prénom et nom sont déjà renseignés", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      firstName: "Alice",
      lastName: "Martin",
      name: "Alice Martin",
      email: "alice@example.gouv.fr",
    });

    await fillMissingUserNamesFromProvider({
      userId: "u1",
      providerId: "proconnect",
      accessToken: "token",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("renseigne uniquement les champs manquants depuis ProConnect", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      firstName: null,
      lastName: null,
      name: "alice@example.gouv.fr",
      email: "alice@example.gouv.fr",
    });
    stubProconnectApis({
      sub: "sub-1",
      email: "alice@example.gouv.fr",
      given_name: "Alice",
      usual_name: "Martin",
    });
    mockUpdate.mockResolvedValue({});

    // Re-import so discovery cache starts empty after resetModules in beforeEach.
    const { fillMissingUserNamesFromProvider: fill } = await import("./proconnect-user");
    await fill({
      userId: "u1",
      providerId: "proconnect",
      accessToken: "token",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        firstName: "Alice",
        lastName: "Martin",
        name: "Alice Martin",
      },
    });
  });

  it("ne écrase pas un nom déjà présent", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      firstName: null,
      lastName: "AdminSet",
      name: "AdminSet",
      email: "alice@example.gouv.fr",
    });
    stubProconnectApis({
      sub: "sub-1",
      given_name: "Alice",
      usual_name: "Martin",
    });
    mockUpdate.mockResolvedValue({});

    const { fillMissingUserNamesFromProvider: fill } = await import("./proconnect-user");
    await fill({
      userId: "u1",
      providerId: "proconnect",
      accessToken: "token",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        firstName: "Alice",
        lastName: "AdminSet",
      },
    });
  });
});
