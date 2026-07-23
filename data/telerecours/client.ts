import { login } from "./auth";
import {
  AuthenticationError,
  PAGINATION_PAGE_SIZE,
  encodeCaseFileNumberSegment,
  encodeFileIdSegment,
  fetchWithRetry,
  parseContentDispositionFileName,
} from "./http";
import { TelerecoursClient } from "./client.interface";
import {
  AttachedFile,
  CaseFile,
  CaseFileActorDto,
  CaseFileDetail,
  CaseFileEvent,
  Hearing,
  PagedResponse,
  RelatedCaseFileSummary,
  StatusGroup,
  StatusGroupType,
} from "./types";

const MAX_LOGIN_ATTEMPTS = 10;

interface ClientCredentials {
  username: string;
  password: string;
}

function parseStatusGroupsResponse(data: unknown): StatusGroup[] {
  if (Array.isArray(data)) {
    return data as StatusGroup[];
  }
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { statuses?: unknown }).statuses)
  ) {
    return (data as { statuses: StatusGroup[] }).statuses;
  }
  throw new Error("Unexpected statusGroups response shape");
}

class TelerecoursCaseFileClient implements TelerecoursClient {
  private accessToken: string | null = null;
  private credentials: ClientCredentials;
  private isLoggingIn = false;
  private statusGroupsCache = new Map<string, StatusGroup[]>();

  constructor(credentials: ClientCredentials) {
    this.credentials = credentials;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken) {
      return;
    }

    if (this.isLoggingIn) {
      let attempts = 0;
      while (this.isLoggingIn && attempts < MAX_LOGIN_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }
      if (this.accessToken) return;
      throw new Error(`Login failed: token still null after ${MAX_LOGIN_ATTEMPTS} attempts`);
    }

    await this.performLogin();
  }

  private async performLogin(): Promise<void> {
    this.isLoggingIn = true;
    try {
      this.accessToken = await login(this.credentials.username, this.credentials.password);
      console.log(`✓ Successfully authenticated for ${this.credentials.username}`);
    } catch (error) {
      this.accessToken = null;
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isLoggingIn = false;
    }
  }

  /** Authenticated GET returning parsed JSON typed as `T`. */
  private async get<T>(path: string, jurisdiction: string): Promise<T> {
    return this.withReauth(async () => {
      const response = await fetchWithRetry(path, this.accessToken!, jurisdiction);
      return (await response.json()) as T;
    });
  }

  /**
   * Download the binary content of a file via
   * `/api/file-api/<encodedFileId>/data` and return it as a Buffer, with the
   * file name (from Content-Disposition) and the MIME type.
   */
  async downloadFile(
    encodedFileId: string,
    jurisdiction: string,
  ): Promise<{ data: Buffer; fileName?: string; mimeType?: string }> {
    return this.withReauth(async () => {
      const response = await fetchWithRetry(
        `/api/file-api/${encodeFileIdSegment(encodedFileId)}/data`,
        this.accessToken!,
        jurisdiction,
        "application/json, text/plain, */*",
      );
      const data = Buffer.from(await response.arrayBuffer());
      return {
        data,
        fileName: parseContentDispositionFileName(response.headers.get("content-disposition")),
        mimeType: response.headers.get("content-type") ?? undefined,
      };
    });
  }

  /**
   * Ensure authentication, execute `fn`, and if the token has expired
   * (AuthenticationError) re-login once and then retry.
   */
  private async withReauth<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureAuthenticated();
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        console.log(`⚠ Authentication expired, attempting to re-login and retry...`);
        this.accessToken = null;

        try {
          await this.ensureAuthenticated();
          return await fn();
        } catch (retryError) {
          throw new Error(
            `Failed after re-authentication: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Fetch status groups from Telerecours (/api/parametres/statusGroups).
   * Cached per jurisdiction and statusType for the lifetime of this client.
   */
  async getStatusGroups(
    jurisdiction: string,
    statusType: StatusGroupType,
  ): Promise<StatusGroup[]> {
    const cacheKey = `${jurisdiction}:${statusType}`;
    const cached = this.statusGroupsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.get<unknown>(
      `/api/parametres/statusGroups?statusType=${statusType}`,
      jurisdiction,
    );
    const groups = parseStatusGroupsResponse(data);
    this.statusGroupsCache.set(cacheKey, groups);
    return groups;
  }

  /**
   * Fetch status group IDs for in-progress dossiers (statusType=INPROGRESS).
   * The result is cached for the lifetime of this client instance.
   */
  async getInProgressStatusGroupIds(jurisdiction: string): Promise<number[]> {
    const groups = await this.getStatusGroups(jurisdiction, "INPROGRESS");
    const groupIds = groups.map((group) => group.id);
    console.log(
      `✓ ${groupIds.length} groupes de statut INPROGRESS : ` +
        groups.map((group) => group.label ?? group.id).join(", "),
    );
    return groupIds;
  }

  async getCaseFiles(
    jurisdiction: string,
    page: number,
    size: number,
    sort?: string,
    statusGroupIds?: number[],
    legalEntityDivisionIds: number[] = [],
  ): Promise<PagedResponse<CaseFile>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });

    if (sort) {
      params.append("sort", sort);
    }
    if (statusGroupIds && statusGroupIds.length > 0) {
      params.append("statusIds", statusGroupIds.join(","));
    }
    if (legalEntityDivisionIds.length > 0) {
      params.append("legalEntityDivisionIds", legalEntityDivisionIds.join(","));
    }

    return this.get(`/api/case-file?${params.toString()}`, jurisdiction);
  }

  getCaseFileDetail(caseFileNumber: string, jurisdiction: string): Promise<CaseFileDetail> {
    return this.get(`/api/case-file/${encodeCaseFileNumberSegment(caseFileNumber)}`, jurisdiction);
  }

  getCaseFileActors(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<PagedResponse<CaseFileActorDto>> {
    return this.get(
      `/api/case-file/${encodeCaseFileNumberSegment(caseFileNumber)}/actors?page=${page}&size=${size}`,
      jurisdiction,
    );
  }

  getCaseFileHearings(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<PagedResponse<Hearing>> {
    return this.get(
      `/api/case-file/${encodeCaseFileNumberSegment(caseFileNumber)}/hearings?page=${page}&size=${size}`,
      jurisdiction,
    );
  }

  getCaseFileMeasures(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<PagedResponse<CaseFileEvent>> {
    return this.get(
      `/api/case-file/${encodeCaseFileNumberSegment(caseFileNumber)}/measures?page=${page}&size=${size}`,
      jurisdiction,
    );
  }

  getCaseFileRelatedReport(
    caseFileNumber: string,
    jurisdiction: string,
  ): Promise<{ accessibleCaseFiles?: RelatedCaseFileSummary[] }> {
    return this.get(
      `/api/case-file/${encodeCaseFileNumberSegment(caseFileNumber)}/related-case-files-report`,
      jurisdiction,
    );
  }

  getCaseFileAttachedFiles(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<PagedResponse<AttachedFile>> {
    return this.get(
      `/api/file-api/${encodeCaseFileNumberSegment(caseFileNumber)}?page=${page}&size=${size}`,
      jurisdiction,
    );
  }
}

const clients = new Map<string, TelerecoursCaseFileClient>();

export function getTelerecoursCaseFileClient(
  credentials: ClientCredentials,
): TelerecoursCaseFileClient {
  const key = `${credentials.username}`;

  if (!clients.has(key)) {
    clients.set(key, new TelerecoursCaseFileClient(credentials));
  }

  return clients.get(key)!;
}
