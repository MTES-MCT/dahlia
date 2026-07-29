import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import type { OAuth2UserInfo } from "better-auth/oauth2";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/app/lib/prisma";

// --- Configuration ProConnect (OIDC) ---------------------------------------
// PROCONNECT_URL = domaine de base de l'environnement ProConnect.
// Intégration : https://fca.integ01.dev-agentconnect.fr
// Les endpoints OIDC vivent sous /api/v2 (cf. discovery).
const PROCONNECT_URL = process.env.PROCONNECT_URL ?? "https://fca.integ01.dev-agentconnect.fr";
const PROCONNECT_DISCOVERY_URL = `${PROCONNECT_URL}/api/v2/.well-known/openid-configuration`;

type ProconnectDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
};

// Le document de discovery et le JWKS sont mis en cache au niveau du module
// (ils changent rarement) pour éviter un aller-retour réseau à chaque connexion.
let discoveryCache: Promise<ProconnectDiscovery> | undefined;

export function getProconnectDiscovery(): Promise<ProconnectDiscovery> {
  if (!discoveryCache) {
    discoveryCache = fetch(PROCONNECT_DISCOVERY_URL).then((res) => {
      if (!res.ok) {
        throw new Error(`ProConnect discovery a répondu ${res.status}`);
      }
      return res.json() as Promise<ProconnectDiscovery>;
    });
  }
  return discoveryCache;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;

async function getProconnectJwks() {
  if (!jwksCache) {
    const discovery = await getProconnectDiscovery();
    jwksCache = createRemoteJWKSet(new URL(discovery.jwks_uri));
  }
  return jwksCache;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: false },
      lastName: { type: "string", required: false, input: false },
      // Access gate: a freshly created ProConnect account is not validated.
      // An administrator sets it to true (SQL today; admin UI later).
      isValidated: { type: "boolean", required: false, input: false, defaultValue: false },
      // Admin flag: grants access to /admin/* (user management). Bootstrap the
      // first admin via SQL / Prisma Studio, same as isValidated.
      isAdmin: { type: "boolean", required: false, input: false, defaultValue: false },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "proconnect",
          discoveryUrl: PROCONNECT_DISCOVERY_URL,
          clientId: process.env.PROCONNECT_CLIENT_ID as string,
          clientSecret: process.env.PROCONNECT_CLIENT_SECRET as string,
          scopes: ["openid", "given_name", "usual_name", "email"],
          pkce: true,
          // ProConnect allows client_secret_post (cf. discovery).
          authentication: "post",
          // ProConnect requires a `nonce` parameter on the authorization request.
          authorizationUrlParams: () => ({ nonce: crypto.randomUUID() }),
          // The ProConnect userinfo is returned as a signed JWT (application/jwt),
          // not in JSON : we need to verify it and then decode it.
          getUserInfo: async (tokens) => {
            const discovery = await getProconnectDiscovery();
            const res = await fetch(discovery.userinfo_endpoint, {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            if (!res.ok) {
              return null;
            }
            const jwt = await res.text();
            const jwks = await getProconnectJwks();
            const { payload } = await jwtVerify(jwt, jwks, {
              issuer: discovery.issuer,
              audience: process.env.PROCONNECT_CLIENT_ID,
            });

            const givenName = (payload.given_name as string | undefined) ?? "";
            const usualName = (payload.usual_name as string | undefined) ?? "";

            // We transport firstName / lastName in addition to the standard fields ;
            // mapProfileToUser (below) copies them to the business fields.
            return {
              id: String(payload.sub),
              email: (payload.email as string | undefined) ?? null,
              emailVerified: true,
              name: `${givenName} ${usualName}`.trim(),
              firstName: givenName,
              lastName: usualName,
            } as OAuth2UserInfo & { firstName: string; lastName: string };
          },
          // `profile` is the object returned by getUserInfo above. We copy
          // firstName / lastName : they are not in the return type of
          // better-auth (based on the standard User) but are well persisted at
          // execution because declared in additionalFields. Hence the cast.
          mapProfileToUser: (profile) =>
            ({
              firstName: profile.firstName as string,
              lastName: profile.lastName as string,
            }) as unknown as Partial<{ name: string }>,
        },
      ],
    }),
  ],
});
