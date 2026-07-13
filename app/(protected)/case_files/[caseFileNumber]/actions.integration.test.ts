import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/app/lib/prisma", async () => {
  const { testPrisma } = await import("@/data/test-support/integration-db");
  return { prisma: testPrisma };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
  rightType?: "LOGEMENT" | null;
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
      qualityCode: "R",
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
      mainClaimantId: 1001,
      litigationType: overrides?.litigationType ?? null,
      rightType: overrides?.rightType ?? null,
      summary: overrides?.summary ?? null,
      productionDeadlineType: overrides?.productionDeadlineType ?? null,
      productionDeadlineDate: overrides?.productionDeadlineDate ?? null,
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
    await resetTestDatabase();
    await seedCaseFile();
  });

  it("persiste les champs de classification en base", async () => {
    const result = await updateCaseFileDetailsFormAction(
      null,
      buildFormData({
        caseFileNumber: CASE_FILE_NUMBER,
        litigationType: "REFERE",
        rightType: "LOGEMENT",
        summary: "Urgence familiale",
      }),
    );

    expect(result).toEqual({ ok: true });

    const updated = await testPrisma.caseFile.findUniqueOrThrow({
      where: { caseFileNumber: CASE_FILE_NUMBER },
    });
    expect(updated.litigationType).toBe("REFERE");
    expect(updated.rightType).toBe("LOGEMENT");
    expect(updated.summary).toBe("Urgence familiale");
    expect(revalidatePath).toHaveBeenCalledWith(`/case_files/${CASE_FILE_NUMBER}`);
  });

  it("efface les champs optionnels lorsque le formulaire les laisse vides", async () => {
    await testPrisma.caseFile.update({
      where: { caseFileNumber: CASE_FILE_NUMBER },
      data: {
        litigationType: "INJONCTION",
        rightType: "HEBERGEMENT",
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
        rightType: "LOGEMENT",
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
        rightType: "LOGEMENT",
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
        rightType: "LOGEMENT",
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
        rightType: "LOGEMENT",
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
        rightType: "LOGEMENT",
        summary: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
