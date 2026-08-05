import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();
const mockScopeFindMany = vi.fn();
const mockCaseFileCount = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    userJurisdictionScope: {
      findMany: (...args: unknown[]) => mockScopeFindMany(...args),
    },
    caseFile: {
      count: (...args: unknown[]) => mockCaseFileCount(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import {
  canAccessCaseFile,
  caseFileRelationScopeWhere,
  caseFileScopeWhere,
  getCurrentCaseFileScope,
} from "./case-file-scope";

function mockSession(user: { id: string; isValidated: boolean; isAdmin: boolean } | null) {
  mockGetSession.mockResolvedValue(user ? { user } : null);
}

function mockScope(jurisdictionIds: number[]) {
  mockScopeFindMany.mockResolvedValue(
    jurisdictionIds.map((jurisdictionId) => ({ jurisdictionId })),
  );
}

describe("case-file-scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentCaseFileScope", () => {
    it("donne un accès sans restriction aux administrateurs", async () => {
      mockSession({ id: "admin-1", isValidated: true, isAdmin: true });

      expect(await getCurrentCaseFileScope()).toEqual({
        unrestricted: true,
        jurisdictionIds: [],
      });
      // No need to read the join table for an administrator.
      expect(mockScopeFindMany).not.toHaveBeenCalled();
    });

    it("lit les juridictions du périmètre pour un utilisateur validé", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([3, 8]);

      expect(await getCurrentCaseFileScope()).toEqual({
        unrestricted: false,
        jurisdictionIds: [3, 8],
      });
      expect(mockScopeFindMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        select: { jurisdictionId: true },
      });
    });

    it("ne donne aucun accès sans session", async () => {
      mockSession(null);

      expect(await getCurrentCaseFileScope()).toEqual({
        unrestricted: false,
        jurisdictionIds: [],
      });
    });

    it("ne donne aucun accès à un utilisateur non validé, même administrateur", async () => {
      mockSession({ id: "u2", isValidated: false, isAdmin: true });

      expect(await getCurrentCaseFileScope()).toEqual({
        unrestricted: false,
        jurisdictionIds: [],
      });
    });
  });

  describe("caseFileScopeWhere", () => {
    it("ne filtre rien pour un administrateur", async () => {
      mockSession({ id: "admin-1", isValidated: true, isAdmin: true });

      expect(await caseFileScopeWhere()).toEqual({});
    });

    it("restreint aux juridictions du périmètre", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([3, 8]);

      expect(await caseFileScopeWhere()).toEqual({ jurisdictionId: { in: [3, 8] } });
    });

    it("exclut tout dossier quand le périmètre est vide", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([]);

      // `IN ()` matches nothing, including case files with no jurisdiction.
      expect(await caseFileScopeWhere()).toEqual({ jurisdictionId: { in: [] } });
    });
  });

  describe("caseFileRelationScopeWhere", () => {
    it("n'ajoute aucune jointure pour un administrateur", async () => {
      mockSession({ id: "admin-1", isValidated: true, isAdmin: true });

      expect(await caseFileRelationScopeWhere()).toEqual({});
    });

    it("porte le filtre sur la relation caseFile", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([3]);

      expect(await caseFileRelationScopeWhere()).toEqual({
        caseFile: { jurisdictionId: { in: [3] } },
      });
    });
  });

  describe("canAccessCaseFile", () => {
    it("compte les dossiers correspondants dans le périmètre", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([3]);
      mockCaseFileCount.mockResolvedValue(1);

      expect(await canAccessCaseFile("TA069-001")).toBe(true);
      expect(mockCaseFileCount).toHaveBeenCalledWith({
        where: { caseFileNumber: "TA069-001", jurisdictionId: { in: [3] } },
      });
    });

    it("refuse un dossier hors périmètre", async () => {
      mockSession({ id: "u1", isValidated: true, isAdmin: false });
      mockScope([3]);
      mockCaseFileCount.mockResolvedValue(0);

      expect(await canAccessCaseFile("TA075-001")).toBe(false);
    });
  });
});
