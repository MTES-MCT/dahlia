import crypto from "crypto";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";

const AUTHORITY = "https://authentification.telerecours.fr";
const API_HOST = "https://administrations.telerecours.fr";
const CLIENT_ID = "padmSTL";
const REDIRECT_URI = `${API_HOST}/auth-callback`;
const SCOPE = "openid profile telerecours";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) " +
  "Gecko/20100101 Firefox/150.0";

function b64url(data: Buffer): string {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

interface PKCEPair {
  verifier: string;
  challenge: string;
}

export function makePKCE(): PKCEPair {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

interface LoginFormData {
  url: string;
  fields: Record<string, string>;
}

class SessionCookies {
  private cookies: Map<string, string> = new Map();

  setCookie(setCookieHeader: string) {
    const parts = setCookieHeader.split(";");
    if (parts.length === 0) return;

    const [nameValue] = parts;
    const [name, ...value] = nameValue.split("=");
    this.cookies.set(name.trim(), value.join("=").trim());
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function fetchWithCookies(
  url: string,
  options: RequestInit & { cookies?: SessionCookies }
): Promise<{ response: Response; cookies: SessionCookies }> {
  const cookies = options.cookies || new SessionCookies();
  const headers = new Headers(options.headers);

  const cookieHeader = cookies.getCookieHeader();
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Get all Set-Cookie headers (Node.js 19+)
  const setCookies = (response.headers as any).getSetCookie?.() || [];
  for (const setCookie of setCookies) {
    cookies.setCookie(setCookie);
  }

  return { response, cookies };
}

export async function fetchLoginForm(
  cookies: SessionCookies,
  challenge: string
): Promise<LoginFormData & { cookies: SessionCookies }> {
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const authorizeUrl = `${AUTHORITY}/connect/authorize?${params.toString()}`;

  const { response, cookies: newCookies } = await fetchWithCookies(
    authorizeUrl,
    {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      cookies,
      redirect: "follow",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch login form: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const loginUrl = response.url;

  const $ = cheerio.load(html);
  const form = $('form[method="post"]').first();

  if (form.length === 0) {
    throw new Error("Login form not found on auth page");
  }

  const fields: Record<string, string> = {};
  form.find("input").each((_, input) => {
    const $input = $(input);
    const name = $input.attr("name");
    const value = $input.attr("value") || "";
    if (name) {
      fields[name] = value;
    }
  });

  if (!fields.__RequestVerificationToken) {
    throw new Error("CSRF token __RequestVerificationToken not found in form");
  }

  if (!fields.ReturnUrl) {
    throw new Error("ReturnUrl not found in login form");
  }


  return { url: loginUrl, fields, cookies: newCookies };
}

export async function submitLogin(
  cookies: SessionCookies,
  loginUrl: string,
  formFields: Record<string, string>,
  username: string,
  password: string
): Promise<{ code: string; cookies: SessionCookies }> {
  const payload = new URLSearchParams({
    ...formFields,
    Username: username,
    Password: password,
    button: "login",
  });

  let currentUrl = loginUrl;
  let currentCookies = cookies;

  let { response, cookies: newCookies } = await fetchWithCookies(loginUrl, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Referer: loginUrl,
      Origin: AUTHORITY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    cookies,
    redirect: "manual",
  });

  currentCookies = newCookies;

  while (
    response.status === 301 ||
    response.status === 302 ||
    response.status === 303 ||
    response.status === 307 ||
    response.status === 308
  ) {
    const location = response.headers.get("Location");
    if (!location) {
      throw new Error("Redirect without Location header");
    }

    if (location.startsWith("/")) {
      currentUrl = AUTHORITY + location;
    } else {
      currentUrl = location;
    }


    if (currentUrl.startsWith(REDIRECT_URI)) {
      const url = new URL(currentUrl);
      const code = url.searchParams.get("code");
      if (!code) {
        throw new Error(
          `Authentication failed: no code returned. URL=${currentUrl}`
        );
      }
      console.log("✓ Authorization code received");
      return { code, cookies: currentCookies };
    }

    ({ response, cookies: newCookies } = await fetchWithCookies(
      currentUrl,
      {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        cookies: currentCookies,
        redirect: "manual",
      }
    ));
    currentCookies = newCookies;
  }

  throw new Error(
    `OIDC flow did not end on auth-callback — check credentials. ` +
      `Last status: ${response.status}`
  );
}

export async function exchangeCode(
  cookies: SessionCookies,
  code: string,
  verifier: string
): Promise<string> {
  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const { response } = await fetchWithCookies(
    `${AUTHORITY}/connect/token`,
    {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cookies,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Token exchange failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const accessToken = data.access_token;

  if (typeof accessToken !== "string") {
    throw new Error(
      `Unexpected token response: access_token not found. Response: ${JSON.stringify(data)}`
    );
  }

  console.log("✓ Access token received");
  return accessToken;
}

export async function login(
  username: string,
  password: string
): Promise<string> {
  const cookies = new SessionCookies();
  const { verifier, challenge } = makePKCE();

  const { url: loginUrl, fields, cookies: c1 } = await fetchLoginForm(
    cookies,
    challenge
  );

  const { code, cookies: c2 } = await submitLogin(
    c1,
    loginUrl,
    fields,
    username,
    password
  );

  const accessToken = await exchangeCode(c2, code, verifier);
  return accessToken;
}
