import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Metadata } from "next";
import { metadata as rootMetadata } from "./layout";
import { metadata as homeMetadata } from "./page";
import { metadata as connexionMetadata } from "./connexion/page";
import { metadata as dashboardMetadata } from "./(protected)/case_files/page";
import { metadata as adminUsersMetadata } from "./(protected)/admin/users/page";
import { generateMetadata as caseFileMetadata } from "./(protected)/case_files/[caseFileNumber]/page";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";

vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/app/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/app/lib/data/case-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/data/case-files")>()),
  fetchCaseFileDetail: vi.fn(),
}));

const mockedFetchCaseFileDetail = vi.mocked(fetchCaseFileDetail);

// Reproduces how Next.js composes a route title with the root template, so the
// assertions below describe the <title> actually rendered in the browser tab.
function resolveTitle(title: Metadata["title"]): string {
  const root = rootMetadata.title;
  if (typeof root !== "object" || root === null || !("template" in root) || !("default" in root)) {
    throw new Error("Le layout racine doit exposer un gabarit et un titre par défaut");
  }
  if (title === undefined || title === null) return root.default;
  if (typeof title !== "string") {
    throw new Error("Les pages doivent exposer un titre sous forme de chaîne");
  }
  return root.template.replace("%s", title);
}

const actor = {
  id: 1,
  actorType: "NATURAL_PERSON" as const,
  firstName: "Jean",
  lastName: "Dupont",
  legalPersonName: null,
  legalEntityName: null,
  lastFirstName: null,
  firstLastName: null,
  legalEntityId: null,
  displayName: null,
  displayNameNormalized: null,
};

const caseFile = {
  caseFileNumber: "2500123",
  litigationType: "EXCES_DE_POUVOIR" as const,
  rightType: "DALO" as const,
  summary: null,
  caseFileActors: [
    { isMainClaimant: true, isMainDefender: false, actor },
    {
      isMainClaimant: false,
      isMainDefender: true,
      actor: { ...actor, id: 2, firstName: null, lastName: "Préfet du Rhône" },
    },
  ],
};

function metadataParams(caseFileNumber: string) {
  return {
    params: Promise.resolve({ caseFileNumber }),
    searchParams: Promise.resolve({}),
  };
}

// RGAA 8.5/8.6 — every route must carry its own, meaningful <title>.
describe("Titres des pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("intitule la page d'accueil", () => {
    expect(resolveTitle(homeMetadata.title)).toBe("Accueil - DAHLIA");
  });

  it("intitule la page de connexion", () => {
    expect(resolveTitle(connexionMetadata.title)).toBe("Connexion - DAHLIA");
  });

  it("intitule le tableau de bord", () => {
    expect(resolveTitle(dashboardMetadata.title)).toBe("Tableau de bord - DAHLIA");
  });

  it("intitule la page d'administration des utilisateurs", () => {
    expect(resolveTitle(adminUsersMetadata.title)).toBe("Utilisateurs - Administration - DAHLIA");
  });

  it("intitule une fiche dossier avec le libellé du dossier", async () => {
    mockedFetchCaseFileDetail.mockResolvedValue(caseFile as never);

    const { title } = await caseFileMetadata(metadataParams("2500123"));

    expect(resolveTitle(title)).toBe(
      "Dossier 2500123 - Dupont Jean c/ Préfet du Rhône - REP - DALO - DAHLIA",
    );
  });

  it("décode le numéro de dossier avant de charger le libellé", async () => {
    mockedFetchCaseFileDetail.mockResolvedValue(caseFile as never);

    await caseFileMetadata(metadataParams(encodeURIComponent("TA069/2500123")));

    expect(mockedFetchCaseFileDetail).toHaveBeenCalledWith("TA069/2500123");
  });

  it("signale un dossier introuvable plutôt qu'un titre vide", async () => {
    mockedFetchCaseFileDetail.mockResolvedValue(null);

    const { title } = await caseFileMetadata(metadataParams("inconnu"));

    expect(resolveTitle(title)).toBe("Dossier introuvable - DAHLIA");
  });

  it("distingue les pages les unes des autres", () => {
    const titles = [
      homeMetadata.title,
      connexionMetadata.title,
      dashboardMetadata.title,
      adminUsersMetadata.title,
    ].map(resolveTitle);

    expect(new Set(titles).size).toBe(titles.length);
  });
});
