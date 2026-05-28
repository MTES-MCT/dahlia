import { login } from "./auth";

const API_HOST = "https://administrations.telerecours.fr";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) " +
  "Gecko/20100101 Firefox/150.0";

interface ClientCredentials {
  username: string;
  password: string;
}

interface CaseFileResponse {
  [key: string]: unknown;
}

class TelerecoursCaseFileClient {
  private accessToken: string | null = null;
  private credentials: ClientCredentials;
  private isLoggingIn = false;

  constructor(credentials: ClientCredentials) {
    this.credentials = credentials;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken) {
      return;
    }

    if (this.isLoggingIn) {
      let attempts = 0;
      while (this.isLoggingIn && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }
      if (this.accessToken) return;
      throw new Error("Login failed: token still null after login attempt");
    }

    await this.performLogin();
  }

  private async performLogin(): Promise<void> {
    this.isLoggingIn = true;
    try {
      this.accessToken = await login(
        this.credentials.username,
        this.credentials.password
      );
      console.log(`✓ Successfully authenticated for ${this.credentials.username}`);
    } catch (error) {
      this.accessToken = null;
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isLoggingIn = false;
    }
  }

  async getCaseFiles(
    jurisdiction: string,
    page: number,
    size: number,
    sort?: string,
    onlyEnrolled = true,
    legalEntityDivisionIds: number[] = []
  ): Promise<CaseFileResponse> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });

    if (sort) {
      params.append("sort", sort);
    }
    if (onlyEnrolled) {
      params.append("onlyEnrolled", "true");
    }
    if (legalEntityDivisionIds.length > 0) {
      params.append("legalEntityDivisionIds", legalEntityDivisionIds.join(','));
    }

    const url = `${API_HOST}/api/case-file?${params.toString()}`;

    try {
      return await this.makeAuthenticatedRequest(url, jurisdiction);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        console.log(
          `⚠ Authentication expired, attempting to re-login and retry...`
        );
        this.accessToken = null;

        try {
          await this.ensureAuthenticated();
          return await this.makeAuthenticatedRequest(url, jurisdiction);
        } catch (retryError) {
          throw new Error(
            `Failed after re-authentication: ${retryError instanceof Error ? retryError.message : String(retryError)}`
          );
        }
      }
      throw error;
    }
  }

  private async makeAuthenticatedRequest(
    url: string,
    jurisdiction: string
  ): Promise<CaseFileResponse> {
    if (!this.accessToken) {
      throw new Error("No access token available");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Authorization: `Bearer ${this.accessToken}`,
        "X-Jurisdiction-Code": jurisdiction,
        Accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        `Authentication required: ${response.status} ${response.statusText}`
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GET /api/case-file failed: ${response.status} ${response.statusText}\n` +
          `Body: ${text.substring(0, 400)}`
      );
    }

    return (await response.json()) as CaseFileResponse;
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

const clients = new Map<string, TelerecoursCaseFileClient>();

export function getTelerecoursCaseFileClient(
  credentials: ClientCredentials
): TelerecoursCaseFileClient {
  const key = `${credentials.username}`;

  if (!clients.has(key)) {
    clients.set(key, new TelerecoursCaseFileClient(credentials));
  }

  return clients.get(key)!;
}
