// Mock ProConnect (OIDC) provider used by the Playwright end-to-end tests.
//
// It implements just enough of the OpenID Connect authorization-code + PKCE flow
// for better-auth's `genericOAuth` plugin (configured in app/lib/auth.ts) to log
// a fixed test agent in, without ever reaching the real ProConnect integration
// environment:
//
//   GET  /api/v2/.well-known/openid-configuration  discovery document
//   GET  /api/v2/authorize                         immediately redirects back with a code
//   POST /api/v2/token                             returns a signed id_token + access_token
//   GET  /api/v2/userinfo                          returns the agent as a signed JWT (application/jwt)
//   GET  /api/v2/jwks                              public keys used to verify the JWTs
//   GET  /api/v2/session/end                       logout endpoint (redirects back to the app)
//
// All identity claims, the issuer and the client id are provided through
// environment variables by playwright.config.ts (see tests/e2e/constants.ts).

import http from "node:http";
import { randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const PORT = Number(process.env.MOCK_PROCONNECT_PORT ?? 9990);
const ISSUER = process.env.MOCK_PROCONNECT_ISSUER ?? `http://localhost:${PORT}`;
const CLIENT_ID = process.env.MOCK_PROCONNECT_CLIENT_ID ?? "dahlia-e2e-client";

const AGENT = {
  sub: process.env.MOCK_PROCONNECT_SUB ?? "e2e-agent-sub",
  email: process.env.MOCK_PROCONNECT_EMAIL ?? "agent.e2e@example.gouv.fr",
  given_name: process.env.MOCK_PROCONNECT_GIVEN_NAME ?? "Camille",
  usual_name: process.env.MOCK_PROCONNECT_USUAL_NAME ?? "Martin",
};

// Signing key (regenerated at each startup; the public part is exposed via JWKS).
const KID = "dahlia-e2e-key";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const publicJwk = { ...(await exportJWK(publicKey)), kid: KID, use: "sig", alg: "RS256" };

const discovery = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/api/v2/authorize`,
  token_endpoint: `${ISSUER}/api/v2/token`,
  userinfo_endpoint: `${ISSUER}/api/v2/userinfo`,
  end_session_endpoint: `${ISSUER}/api/v2/session/end`,
  jwks_uri: `${ISSUER}/api/v2/jwks`,
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  userinfo_signing_alg_values_supported: ["RS256"],
  scopes_supported: ["openid", "given_name", "usual_name", "email"],
  token_endpoint_auth_methods_supported: ["client_secret_post"],
  grant_types_supported: ["authorization_code"],
  code_challenge_methods_supported: ["S256"],
};

// In-memory store: authorization code -> nonce carried over from /authorize, so
// the issued id_token can echo it back (some OIDC clients verify it).
const codeStore = new Map();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function signJwt(extraClaims, expiresIn = "1h") {
  return new SignJWT(extraClaims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(ISSUER)
    .setSubject(AGENT.sub)
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  const { pathname } = url;

  try {
    if (pathname === "/api/v2/.well-known/openid-configuration") {
      return sendJson(res, 200, discovery);
    }

    if (pathname === "/api/v2/jwks") {
      return sendJson(res, 200, { keys: [publicJwk] });
    }

    // Authorization endpoint: the agent is always "already authenticated" on the
    // mock, so we skip any login screen and redirect straight back to the app
    // callback with a fresh authorization code.
    if (pathname === "/api/v2/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");
      const nonce = url.searchParams.get("nonce");
      if (!redirectUri) {
        return sendJson(res, 400, { error: "missing redirect_uri" });
      }
      const code = randomUUID();
      codeStore.set(code, { nonce });
      const location = new URL(redirectUri);
      location.searchParams.set("code", code);
      if (state) location.searchParams.set("state", state);
      res.writeHead(302, { Location: location.toString() });
      return res.end();
    }

    // Token endpoint: exchange the code for an access_token + id_token. PKCE and
    // client authentication are accepted without verification (mock provider).
    if (pathname === "/api/v2/token" && req.method === "POST") {
      const params = new URLSearchParams(await readBody(req));
      const code = params.get("code");
      const entry = (code && codeStore.get(code)) || {};
      if (code) codeStore.delete(code);

      const idToken = await signJwt({
        nonce: entry.nonce,
        email: AGENT.email,
        given_name: AGENT.given_name,
        usual_name: AGENT.usual_name,
      });

      return sendJson(res, 200, {
        access_token: randomUUID(),
        token_type: "Bearer",
        expires_in: 3600,
        id_token: idToken,
        scope: "openid given_name usual_name email",
      });
    }

    // Userinfo endpoint: ProConnect returns a *signed JWT* (application/jwt),
    // not JSON — app/lib/auth.ts verifies it against the JWKS above.
    if (pathname === "/api/v2/userinfo") {
      const jwt = await signJwt({
        email: AGENT.email,
        given_name: AGENT.given_name,
        usual_name: AGENT.usual_name,
      });
      res.writeHead(200, { "content-type": "application/jwt" });
      return res.end(jwt);
    }

    // Logout endpoint: bounce back to the post-logout redirect (the app home).
    if (pathname === "/api/v2/session/end") {
      const postLogout = url.searchParams.get("post_logout_redirect_uri") ?? ISSUER;
      res.writeHead(302, { Location: postLogout });
      return res.end();
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  } catch (error) {
    console.error("[mock-proconnect] error handling", pathname, error);
    sendJson(res, 500, { error: "internal_error" });
  }
});

server.listen(PORT, () => {
  console.log(`[mock-proconnect] listening on ${ISSUER}`);
});
