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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { revalidatePath } from "next/cache";
import { updateCaseFileDetailsFormAction } from "./actions";
import {
  setupTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "@/data/test-support/integration-db";

const CASE_FILE_NUMBER = "TA069-001";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

async function seedCaseFile(overrides?: {
  litigationType?: "REFERE" | null;
  rightType?: "DALO" | null;
  summary?: string | null;
  productionDeadlineType?: "MISE_EN_DEMEURE_DE_PRODUIRE" | null;
  productionDeadlineDate?: Date | null;
}): Promise<void> {
  await testPrisma.quality.create({ data: { code: "R", name: "Requérant" } });
  await testPrisma.legalEntityDivision.create({
    data: { id: 2488, name: "DDETS du Rhône", shortName: "DDETS69" },
  });
  await testPrisma.status.create({
    data: { id: 5, label: "En cours", category: "INSTRUCTION", groupId: 2 },
  });
  await testPrisma.actor.create({
    data: {
      id: 1001,
      actorType: "NATURAL_PERSON",
      firstName: "Jean",
      lastName: "Dupont",
    },
  });
  await testPrisma.caseFile.create({
    data: {
      caseFileNumber: CASE_FILE_NUMBER,
      title: "Recours DALO",
      type: "DALO",
      depositDate: new Date("2025-12-02T00:00:00Z"),
      assignedToLegalEntityDivisionId: 2488,
      lastStatusId: 5,
      lastStatusDate: new Date("2026-01-10T00:00:00Z"),
      litigationType: overrides?.litigationType ?? null,
      rightType: overrides?.rightType ?? null,
      summary: overrides?.summary ?? null,
      productionDeadlineType: overrides?.productionDeadlineType ?? null,
      productionDeadlineDate: overrides?.productionDeadlineDate ?? null,
    },
  });
  await testPrisma.caseFileActor.create({
    data: {
      caseFileNumber: CASE_FILE_NUMBER,
      actorId: 1001,
      qualityCode: "R",
      isMainClaimant: true,
      isMainDefender: false,
    },
  });
}

describe("updateCaseFileDetailsFormAction (integration)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    vi.mocked(revalidatePath).mockClear();
    mockGetSession.mockReset();
    // Administrator by default: the tests below are about the form itself, not
    // about the permission scope (which has its own tests at the end).
    mockGetSession.mockResolvedValue({
      user: { id: "admin-integration", isValidated: true, isAdmin: true },
    });
    await resetTestDatabase();
    await seedCaseFile();
  });

  it("persiste les champs de classification en base", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "REFERE",
        rightType: "DALO",
        summary: "Urgence familiale",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.litigationType).toBe("REFERE");
    expect(updated.rightType).toBe("DALO");
    expect(updated.summary).toBe("Urgence familiale");
    expect(revalidatePath).toHaveBeenCalledWith(`/case_files/${CASE_FILE_NUMBER}`);
  });

  it("efface les champs optionnels lorsque le formulaire les laisse vides", async () => {
    await testPrisma.caseFile.update({
      where: { caseFileNumber: CASE_FILE_NUMBER },
      data: {
        litigationType: "INJONCTION",
        rightType: "DAHO",
        summary: "Ancienne raison",
      },
    });

    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "",
        rightType: "",
        summary: "",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.litigationType).toBeNull();
    expect(updated.rightType).toBeNull();
    expect(updated.summary).toBeNull();
  });

  it("persiste l'échéance à produire lorsque les champs dédiés sont envoyés", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "INDEMNITAIRE",
        rightType: "DALO",
        summary: "",
        hasProductionDeadlineFields: "true",
        productionDeadlineType: "MISE_EN_DEMEURE_DE_PRODUIRE",
        productionDeadlineDate: "2026-03-15",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.productionDeadlineType).toBe("MISE_EN_DEMEURE_DE_PRODUIRE");
    expect(updated.productionDeadlineDate).toEqual(new Date("2026-03-15T00:00:00.000Z"));
  });

  it("efface l'échéance à produire lorsque le type est laissé vide", async () => {
    await testPrisma.caseFile.update({
      where: { caseFileNumber: CASE_FILE_NUMBER },
      data: {
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        productionDeadlineDate: new Date("2026-02-01T00:00:00Z"),
      },
    });

    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "",
        rightType: "",
        summary: "",
        hasProductionDeadlineFields: "true",
        productionDeadlineType: "",
        productionDeadlineDate: "",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.productionDeadlineType).toBeNull();
    expect(updated.productionDeadlineDate).toBeNull();
  });

  it("ne modifie pas l'échéance à produire lorsque les champs dédiés sont absents", async () => {
    await testPrisma.caseFile.update({
      where: { caseFileNumber: CASE_FILE_NUMBER },
      data: {
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        productionDeadlineDate: new Date("2026-02-01T00:00:00Z"),
      },
    });

    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "REFERE",
        rightType: "DALO",
        summary: "Nouvelle raison",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.litigationType).toBe("REFERE");
    expect(updated.summary).toBe("Nouvelle raison");
    expect(updated.productionDeadlineType).toBe("CLOTURE_INSTRUCTION");
    expect(updated.productionDeadlineDate).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("refuse un numéro de dossier manquant", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        litigationType: "REFERE",
        rightType: "DALO",
        summary: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Numéro de dossier manquant." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse un type de contentieux invalide", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "INVALID",
        rightType: "DALO",
        summary: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Type de contentieux invalide." });

    const unchanged = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(unchanged.litigationType).toBeNull();
  });

  it("refuse une date limite de production manquante lorsque le type est renseigné", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "",
        rightType: "",
        summary: "",
        hasProductionDeadlineFields: "true",
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        productionDeadlineDate: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Date limite de production requise." });
  });

  it("retourne une erreur lorsque le dossier n'existe pas", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: "INEXISTANT",
        litigationType: "REFERE",
        rightType: "DALO",
        summary: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  describe("périmètre de droit", () => {
    // Attach the seeded case file to a jurisdiction, and connect as a
    // non-administrator whose scope holds `scopedTo`.
    async function seedScopedUser(options: {
      caseFileJurisdiction: string | null;
      scopedTo: string;
    }): Promise<void> {
      const scoped = await testPrisma.jurisdiction.create({
        data: { name: "", shortName: options.scopedTo },
      });
      if (options.caseFileJurisdiction) {
        const jurisdiction =
          options.caseFileJurisdiction === options.scopedTo
            ? scoped
            : await testPrisma.jurisdiction.create({
                data: { name: "", shortName: options.caseFileJurisdiction },
              });
        await testPrisma.caseFile.update({
          where: { caseFileNumber: CASE_FILE_NUMBER },
          data: { jurisdictionId: jurisdiction.id },
        });
      }

      await testPrisma.user.create({
        data: {
          id: "scoped-user",
          email: "scoped@example.gouv.fr",
          emailVerified: true,
          name: "Scoped User",
          isValidated: true,
          isAdmin: false,
          jurisdictionScopes: { create: [{ jurisdictionId: scoped.id }] },
        },
      });
      mockGetSession.mockResolvedValue({
        user: { id: "scoped-user", isValidated: true, isAdmin: false },
      });
    }

    async function editSummary(summary: string) {
      return updateCaseFileDetailsFormAction(
        null,
        buildFormData({
          caseFileNumber: CASE_FILE_NUMBER,
          litigationType: "REFERE",
          rightType: "DALO",
          summary,
        }),
      );
    }

    it("autorise la modification d'un dossier du périmètre", async () => {
      await seedScopedUser({ caseFileJurisdiction: "TA069", scopedTo: "TA069" });

      expect(await editSummary("Dans mon périmètre")).toEqual({ ok: true });

      const updated = await testPrisma.caseFile.findUniqueOrThrow({
        where: { caseFileNumber: CASE_FILE_NUMBER },
      });
      expect(updated.summary).toBe("Dans mon périmètre");
    });

    it("refuse la modification d'un dossier d'une autre juridiction", async () => {
      await seedScopedUser({ caseFileJurisdiction: "TA075", scopedTo: "TA069" });

      expect(await editSummary("Interdit")).toEqual({ ok: false, error: "Dossier introuvable." });

      const unchanged = await testPrisma.caseFile.findUniqueOrThrow({
        where: { caseFileNumber: CASE_FILE_NUMBER },
      });
      expect(unchanged.summary).toBeNull();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuse la modification d'un dossier sans juridiction", async () => {
      // Case files imported before the Jurisdiction model carry no jurisdiction:
      // they are reachable by administrators only.
      await seedScopedUser({ caseFileJurisdiction: null, scopedTo: "TA069" });

      expect(await editSummary("Interdit")).toEqual({ ok: false, error: "Dossier introuvable." });

      const unchanged = await testPrisma.caseFile.findUniqueOrThrow({
        where: { caseFileNumber: CASE_FILE_NUMBER },
      });
      expect(unchanged.summary).toBeNull();
    });
  });
});
