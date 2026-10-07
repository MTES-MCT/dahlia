import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("@/app/lib/prisma", async () => {
  const { testPrisma } = await import("@/data/test-support/integration-db");
  return { prisma: testPrisma };
});

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  // The events table reads its page size from a cookie.
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { fetchCaseFileDetail, fetchCaseFilesTableData } from "@/app/lib/data/case-files";
import { fetchCaseFileEventsTableData } from "@/app/lib/data/case-file-events";

const LYON = { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" };
const PARIS = { jurisdictionCode: "TA075", caseFileNumber: "TA075-001" };
// Same court as LYON, but not tagged with a Dahlia jurisdiction instance.
const ORPHAN = { jurisdictionCode: "TA069", caseFileNumber: "SANS-JURIDICTION-001" };

// Ids assigned by `seedCaseFiles`, needed to build the users' permission scopes.
let lyonJurisdictionId: number;

// Three case files: one in Lyon, one in Paris, and one carrying no jurisdiction
// at all (as imported before the Jurisdiction model existed).
async function seedCaseFiles(): Promise<void> {
  await testPrisma.status.create({
    data: { id: 5, label: "En cours", category: "INSTRUCTION", groupId: 2 },
  });
  await testPrisma.legalEntityDivision.create({
    data: { id: 2488, name: "DDETS du Rhône", shortName: "DDETS69" },
  });
  await testPrisma.measure.create({
    data: { code: "REQ", label: "Requête", type: "EVENEMENT", isImportant: false },
  });

  const lyon = await testPrisma.jurisdiction.create({
    data: { name: "", shortName: "TA069", jurisdictionCode: "TA069" },
  });
  const paris = await testPrisma.jurisdiction.create({
    data: { name: "", shortName: "TA075", jurisdictionCode: "TA075" },
  });
  lyonJurisdictionId = lyon.id;

  let eventId = 1;
  for (const [key, jurisdictionId] of [
    [LYON, lyon.id],
    [PARIS, paris.id],
    [ORPHAN, null],
  ] as const) {
    const { jurisdictionCode, caseFileNumber } = key;
    await testPrisma.caseFile.create({
      data: {
        jurisdictionCode,
        caseFileNumber,
        title: "Recours DALO",
        type: "DALO",
        depositDate: new Date("2025-12-02T00:00:00Z"),
        assignedToLegalEntityDivisionId: 2488,
        lastStatusId: 5,
        lastStatusDate: new Date("2026-01-10T00:00:00Z"),
        jurisdictionId,
      },
    });
    const event = await testPrisma.caseFileEvent.create({
      data: {
        jurisdictionCode,
        id: eventId++,
        caseFileNumber,
        measureCode: "REQ",
        eventDate: new Date("2026-01-05T00:00:00Z"),
      },
    });
    await testPrisma.fileFamilyType.upsert({
      where: { code: "REQ" },
      update: {},
      create: { code: "REQ", label: "Requête" },
    });
    await testPrisma.attachedFile.create({
      data: {
        jurisdictionCode,
        encodedFileId: `piece-${caseFileNumber}`,
        originalFileName: "requete.pdf",
        fileName: "requete.pdf",
        mimeType: "application/pdf",
        documentType: "PDF",
        fileTypeLabel: "Requête",
        eventCreationDate: new Date("2026-01-05T00:00:00Z"),
        caseFileNumber,
        eventId: event.id,
        fileFamilyTypeCode: "REQ",
      },
    });
  }
}

// Connect as a non-administrator whose permission scope holds `jurisdictionIds`.
async function connectScopedUser(jurisdictionIds: number[]): Promise<void> {
  await testPrisma.user.create({
    data: {
      id: "scoped-user",
      email: "scoped@example.gouv.fr",
      emailVerified: true,
      name: "Scoped User",
      isValidated: true,
      isAdmin: false,
      jurisdictionScopes: { create: jurisdictionIds.map((jurisdictionId) => ({ jurisdictionId })) },
    },
  });
  mockGetSession.mockResolvedValue({
    user: { id: "scoped-user", isValidated: true, isAdmin: false },
  });
}

async function connectAdmin(jurisdictionIds: number[] = []): Promise<void> {
  await testPrisma.user.create({
    data: {
      id: "admin-integration",
      email: "admin@example.gouv.fr",
      emailVerified: true,
      name: "Admin",
      isValidated: true,
      isAdmin: true,
      jurisdictionScopes: { create: jurisdictionIds.map((jurisdictionId) => ({ jurisdictionId })) },
    },
  });
  mockGetSession.mockResolvedValue({
    user: { id: "admin-integration", isValidated: true, isAdmin: true },
  });
}

// `fetchCaseFileDetail` takes the two key parts (React `cache` keys on arguments).
function caseFileDetail(key: { jurisdictionCode: string; caseFileNumber: string }) {
  return fetchCaseFileDetail(key.jurisdictionCode, key.caseFileNumber);
}

async function dashboardCaseFileNumbers(): Promise<string[]> {
  const { rows } = await fetchCaseFilesTableData(1, 50, "caseFileNumber", "ascending");
  return rows.map((row) => row.caseFileNumber);
}

describe("périmètre de droit sur les dossiers (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetTestDatabase();
    await seedCaseFiles();
  });

  it("limite le tableau de bord aux juridictions du périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    const { rows, totalCount } = await fetchCaseFilesTableData(
      1,
      50,
      "caseFileNumber",
      "ascending",
    );

    expect(rows.map((row) => row.caseFileNumber)).toEqual([LYON.caseFileNumber]);
    // The count drives the pagination and the caption: it must agree with the rows.
    expect(totalCount).toBe(1);
  });

  it("ne renvoie aucun dossier quand le périmètre est vide", async () => {
    await connectScopedUser([]);

    expect(await dashboardCaseFileNumbers()).toEqual([]);
  });

  it("ne renvoie aucun dossier sans session", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await dashboardCaseFileNumbers()).toEqual([]);
  });

  it("montre tous les dossiers à un administrateur sans juridiction, y compris ceux sans juridiction", async () => {
    await connectAdmin();

    expect(await dashboardCaseFileNumbers()).toEqual(
      [LYON, PARIS, ORPHAN].map((key) => key.caseFileNumber).sort(),
    );
  });

  it("limite un administrateur aux juridictions qui lui sont assignées", async () => {
    await connectAdmin([lyonJurisdictionId]);

    expect(await dashboardCaseFileNumbers()).toEqual([LYON.caseFileNumber]);
    expect(await caseFileDetail(PARIS)).toBeNull();
    expect(await caseFileDetail(ORPHAN)).toBeNull();
  });

  it("renvoie null sur le détail d'un dossier hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect(await caseFileDetail(LYON)).not.toBeNull();
    // Out of scope and no jurisdiction alike read as "not found", which is what
    // makes the detail page answer 404 without leaking their existence.
    expect(await caseFileDetail(PARIS)).toBeNull();
    expect(await caseFileDetail(ORPHAN)).toBeNull();
  });

  it("renvoie null sur une pièce hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect(await fetchAttachedFile(LYON, `piece-${LYON.caseFileNumber}`)).not.toBeNull();
    // This is what makes the pièce routes (viewer and zip download) answer 404.
    expect(await fetchAttachedFile(PARIS, `piece-${PARIS.caseFileNumber}`)).toBeNull();
    expect(await fetchAttachedFile(ORPHAN, `piece-${ORPHAN.caseFileNumber}`)).toBeNull();
  });

  it("masque l'historique d'un dossier hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect((await fetchCaseFileEventsTableData(LYON, {})).totalCount).toBe(1);
    expect((await fetchCaseFileEventsTableData(PARIS, {})).totalCount).toBe(0);
  });

  it("distingue deux dossiers de même numéro dans deux tribunaux", async () => {
    // Same number as LYON, in the Paris court.
    const parisTwin = { jurisdictionCode: "TA075", caseFileNumber: LYON.caseFileNumber };
    const paris = await testPrisma.jurisdiction.findUniqueOrThrow({
      where: { shortName: "TA075" },
    });
    await testPrisma.caseFile.create({
      data: {
        ...parisTwin,
        title: "Recours DAHO",
        lastStatusId: 5,
        lastStatusDate: new Date("2026-01-10T00:00:00Z"),
        jurisdictionId: paris.id,
      },
    });
    await connectScopedUser([lyonJurisdictionId]);

    expect((await caseFileDetail(LYON))?.title).toBe("Recours DALO");
    // The Paris twin stays out of a Lyon-only scope.
    expect(await caseFileDetail(parisTwin)).toBeNull();
    expect(await dashboardCaseFileNumbers()).toEqual([LYON.caseFileNumber]);
  });
});
