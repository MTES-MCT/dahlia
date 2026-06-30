import { describe, it, expect } from "vitest";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { HISTORIQUE_PARAMS } from "@/app/lib/historique-table";
import { PIECES_PARAMS } from "@/app/lib/pieces-table";
import {
  buildDashboardSortHiddenParams,
  buildTableSearchContext,
} from "@/app/lib/table-search-context";

describe("buildTableSearchContext", () => {
  it("extrait la requête courante et exclut query/page des champs cachés", () => {
    const context = buildTableSearchContext(
      {
        tab: "pieces",
        pcq: "requête",
        pcPage: "3",
        pcSort: "date",
        hiq: "audience",
      },
      PIECES_PARAMS,
      "/case_files/TA069-2026-001",
    );

    expect(context.currentQuery).toBe("requête");
    expect(context.action).toBe("/case_files/TA069-2026-001");
    expect(context.hiddenParams).toEqual([
      { name: "tab", value: "pieces" },
      { name: "pcSort", value: "date" },
      { name: "hiq", value: "audience" },
    ]);
    expect(context.resetHref).toBe(
      "/case_files/TA069-2026-001?tab=pieces&pcSort=date&hiq=audience",
    );
  });

  it("retourne le pathname seul quand aucun param ne subsiste au reset", () => {
    const context = buildTableSearchContext({ pcq: "dupont" }, PIECES_PARAMS, "/case_files/123");

    expect(context.resetHref).toBe("/case_files/123");
    expect(context.hiddenParams).toEqual([]);
  });

  it("ignore les valeurs non string des searchParams", () => {
    const context = buildTableSearchContext(
      { hiq: ["a", "b"] as unknown as string, tab: "historique" },
      HISTORIQUE_PARAMS,
      "/case_files/456",
    );

    expect(context.hiddenParams).toEqual([{ name: "tab", value: "historique" }]);
  });

  it("peut exclure des clés visibles ailleurs dans le formulaire", () => {
    const context = buildTableSearchContext(
      { dahliaq: "dupont", statut: "Terminé", sortBy: "caseFileNumber" },
      DASHBOARD_TABLE_PARAMS,
      "/case_files",
      { excludeFromHidden: ["statut"] },
    );

    expect(context.hiddenParams).toEqual([{ name: "sortBy", value: "caseFileNumber" }]);
    expect(context.resetHref).toBe("/case_files?sortBy=caseFileNumber");
  });
});

describe("buildDashboardSortHiddenParams", () => {
  it("n'émet le tri que lorsque sortBy est explicite", () => {
    expect(buildDashboardSortHiddenParams()).toEqual([]);
    expect(buildDashboardSortHiddenParams(undefined, "ascending")).toEqual([]);
  });

  it("émet sortBy seul ou sortBy + sortOrder", () => {
    expect(buildDashboardSortHiddenParams("caseFileNumber")).toEqual([
      { name: "sortBy", value: "caseFileNumber" },
    ]);
    expect(buildDashboardSortHiddenParams("caseFileNumber", "ascending")).toEqual([
      { name: "sortBy", value: "caseFileNumber" },
      { name: "sortOrder", value: "ascending" },
    ]);
  });
});
