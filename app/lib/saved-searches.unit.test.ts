import { describe, it, expect } from "vitest";
import {
  dashboardSearchHref,
  findCurrentSavedSearch,
  type SavedSearchView,
} from "./saved-searches";

const SEARCHES: SavedSearchView[] = [
  { id: 1, name: "Référés", query: "recours:Référé", statusGroup: "en_cours" },
  { id: 2, name: "Référés terminés", query: "recours:Référé", statusGroup: "termine" },
];

describe("dashboardSearchHref", () => {
  it("construit l'URL de la recherche dans son onglet", () => {
    expect(dashboardSearchHref("dupont statut:Terminé", "termine")).toBe(
      "/case_files?dahliaq=dupont+statut%3ATermin%C3%A9&groupe=termine",
    );
  });

  it("conserve le tri courant", () => {
    expect(
      dashboardSearchHref("dupont", "tous", { sortBy: "caseFileNumber", sortOrder: "descending" }),
    ).toBe("/case_files?sortBy=caseFileNumber&sortOrder=descending&dahliaq=dupont&groupe=tous");
  });

  it("efface la recherche quand elle est vide", () => {
    expect(dashboardSearchHref("", "en_cours")).toBe("/case_files?groupe=en_cours");
  });
});

describe("findCurrentSavedSearch", () => {
  it("trouve la recherche ayant la même requête dans le même onglet", () => {
    expect(findCurrentSavedSearch(SEARCHES, "recours:Référé", "termine")?.id).toBe(2);
  });

  it("ne trouve rien pour une autre requête ou un autre onglet", () => {
    expect(findCurrentSavedSearch(SEARCHES, "dupont", "en_cours")).toBeUndefined();
    expect(findCurrentSavedSearch(SEARCHES, "recours:Référé", "tous")).toBeUndefined();
  });

  it("ne trouve rien sans recherche", () => {
    expect(findCurrentSavedSearch(SEARCHES, "  ", "en_cours")).toBeUndefined();
  });
});
