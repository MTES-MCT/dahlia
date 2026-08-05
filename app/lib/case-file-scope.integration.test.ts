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

const LYON = "TA069-001";
const PARIS = "TA075-001";
const ORPHAN = "SANS-JURIDICTION-001";

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

  const lyon = await testPrisma.jurisdiction.create({ data: { name: "", shortName: "TA069" } });
  const paris = await testPrisma.jurisdiction.create({ data: { name: "", shortName: "TA075" } });
  lyonJurisdictionId = lyon.id;

  let eventId = 1;
  for (const [caseFileNumber, jurisdictionId] of [
    [LYON, lyon.id],
    [PARIS, paris.id],
    [ORPHAN, null],
  ] as const) {
    await testPrisma.caseFile.create({
      data: {
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

function connectAdmin(): void {
  mockGetSession.mockResolvedValue({
    user: { id: "admin-integration", isValidated: true, isAdmin: true },
  });
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

    expect(rows.map((row) => row.caseFileNumber)).toEqual([LYON]);
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

  it("montre tous les dossiers à un administrateur, y compris ceux sans juridiction", async () => {
    connectAdmin();

    expect(await dashboardCaseFileNumbers()).toEqual([LYON, PARIS, ORPHAN].sort());
  });

  it("renvoie null sur le détail d'un dossier hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect(await fetchCaseFileDetail(LYON)).not.toBeNull();
    // Out of scope and no jurisdiction alike read as "not found", which is what
    // makes the detail page answer 404 without leaking their existence.
    expect(await fetchCaseFileDetail(PARIS)).toBeNull();
    expect(await fetchCaseFileDetail(ORPHAN)).toBeNull();
  });

  it("renvoie null sur une pièce hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect(await fetchAttachedFile(`piece-${LYON}`)).not.toBeNull();
    // This is what makes the pièce routes (viewer and zip download) answer 404.
    expect(await fetchAttachedFile(`piece-${PARIS}`)).toBeNull();
    expect(await fetchAttachedFile(`piece-${ORPHAN}`)).toBeNull();
  });

  it("masque l'historique d'un dossier hors périmètre", async () => {
    await connectScopedUser([lyonJurisdictionId]);

    expect((await fetchCaseFileEventsTableData(LYON, {})).totalCount).toBe(1);
    expect((await fetchCaseFileEventsTableData(PARIS, {})).totalCount).toBe(0);
  });
});
