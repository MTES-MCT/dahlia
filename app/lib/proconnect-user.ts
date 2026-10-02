import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/app/lib/prisma";

const PROCONNECT_URL = process.env.PROCONNECT_URL ?? "https://fca.integ01.dev-agentconnect.fr";
const PROCONNECT_DISCOVERY_URL = `${PROCONNECT_URL}/api/v2/.well-known/openid-configuration`;

type ProconnectDiscovery = {
  issuer: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint: string;
};

export type ProconnectUserInfo = {
  id: string;
  email: string | null;
  emailVerified: true;
  name: string;
  firstName: string;
  lastName: string;
};

let discoveryCache: Promise<ProconnectDiscovery> | undefined;
let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;

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

async function getProconnectJwks() {
  if (!jwksCache) {
    const discovery = await getProconnectDiscovery();
    jwksCache = createRemoteJWKSet(new URL(discovery.jwks_uri));
  }
  return jwksCache;
}

// Fetch and verify ProConnect userinfo (JWT) → id, email, given/usual name.
export async function fetchProconnectUserInfo(
  accessToken: string,
): Promise<ProconnectUserInfo | null> {
  const discovery = await getProconnectDiscovery();
  const res = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

  const firstName = ((payload.given_name as string | undefined) ?? "").trim();
  const lastName = ((payload.usual_name as string | undefined) ?? "").trim();
  return {
    id: String(payload.sub),
    email: (payload.email as string | undefined) ?? null,
    emailVerified: true,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
  };
}

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

// Persist ProConnect first/last name onto the user only when the DB field is empty.
// firstName/lastName are additionalFields with input: false, so Better Auth's
// mapProfileToUser cannot write them — this hook fills the gap on login/link.
export async function fillMissingUserNamesFromProvider(options: {
  userId: string;
  providerId: string;
  accessToken: string | null | undefined;
}): Promise<void> {
  const { userId, providerId, accessToken } = options;
  if (providerId !== "proconnect" || !accessToken) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, name: true, email: true },
  });
  if (!user) {
    return;
  }

  const needsFirstName = isBlank(user.firstName);
  const needsLastName = isBlank(user.lastName);
  if (!needsFirstName && !needsLastName) {
    return;
  }

  const profile = await fetchProconnectUserInfo(accessToken);
  if (!profile) {
    return;
  }

  const firstName = needsFirstName && profile.firstName ? profile.firstName : user.firstName;
  const lastName = needsLastName && profile.lastName ? profile.lastName : user.lastName;

  if (firstName === user.firstName && lastName === user.lastName) {
    return;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      // Refresh display name when it was still the email fallback (or empty).
      ...(displayName && (isBlank(user.name) || user.name === user.email)
        ? { name: displayName }
        : {}),
    },
  });
}
