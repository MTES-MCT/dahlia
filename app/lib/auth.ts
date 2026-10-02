import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import type { OAuth2UserInfo } from "better-auth/oauth2";
import { prisma } from "@/app/lib/prisma";
import {
  fetchProconnectUserInfo,
  fillMissingUserNamesFromProvider,
  getProconnectDiscovery,
} from "@/app/lib/proconnect-user";

// --- Configuration ProConnect (OIDC) ---------------------------------------
// PROCONNECT_URL = domaine de base de l'environnement ProConnect.
// Intégration : https://fca.integ01.dev-agentconnect.fr
// Les endpoints OIDC vivent sous /api/v2 (cf. discovery).
const PROCONNECT_URL = process.env.PROCONNECT_URL ?? "https://fca.integ01.dev-agentconnect.fr";
const PROCONNECT_DISCOVERY_URL = `${PROCONNECT_URL}/api/v2/.well-known/openid-configuration`;

export { getProconnectDiscovery };

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Pre-created users (admin UI) only have a `users` row until first ProConnect
  // login. Implicit linking then attaches the OAuth account; ProConnect is
  // trusted because it is our sole IdP and verifies emails.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["proconnect"],
    },
  },
  // After ProConnect account create/update (first login or token refresh), backfill
  // empty firstName/lastName from the IdP. These fields are input:false so
  // mapProfileToUser cannot persist them through Better Auth's user API.
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          await fillMissingUserNamesFromProvider({
            userId: account.userId,
            providerId: account.providerId,
            accessToken: account.accessToken,
          });
        },
      },
      update: {
        after: async (account) => {
          await fillMissingUserNamesFromProvider({
            userId: account.userId,
            providerId: account.providerId,
            accessToken: account.accessToken,
          });
        },
      },
    },
  },
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
            if (!tokens.accessToken) {
              return null;
            }
            const profile = await fetchProconnectUserInfo(tokens.accessToken);
            if (!profile) {
              return null;
            }
            return profile as OAuth2UserInfo & { firstName: string; lastName: string };
          },
          // Kept for documentation / future input:true fields. firstName/lastName
          // are input:false so Better Auth ignores these on persist; the
          // databaseHooks above fill empty names after account create/update.
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
