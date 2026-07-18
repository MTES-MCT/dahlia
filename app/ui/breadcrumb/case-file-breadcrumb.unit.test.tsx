import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { mainClaimantCaseFileActors } from "@/app/lib/test-support/case-file-actors.fixture";
import {
  CaseFileBreadcrumb,
  caseFileLabel,
  buildDashboardBreadcrumbSegment,
  buildCaseFileBreadcrumbSegment,
} from "./case-file-breadcrumb";

describe("caseFileLabel", () => {
  const caseFile = {
    caseFileNumber: "TA069-2026-001",
    title: "Requête DALO",
    litigationType: "INJONCTION" as const,
    rightType: "LOGEMENT" as const,
    summary: "Urgence familiale",
    caseFileActors: mainClaimantCaseFileActors(),
  };

  it("formate le nom d'affichage complet du dossier", () => {
    expect(caseFileLabel(caseFile)).toBe(
      "TA069-2026-001 - Requête DALO - Dupont Jean - Injonction - L (Urgence familiale)",
    );
  });

  it("omet les segments non renseignés", () => {
    expect(
      caseFileLabel({
        caseFileNumber: "TA069-2026-001",
        title: null,
        litigationType: null,
        rightType: null,
        summary: null,
        caseFileActors: [],
      }),
    ).toBe("TA069-2026-001");
  });
});

describe("buildDashboardBreadcrumbSegment", () => {
  it("links to the case files list without query params", () => {
    const segment = buildDashboardBreadcrumbSegment({});

    expect(segment.linkProps.href).toBe("/case_files");
  });

  it("preserves carried search params in the dashboard link", () => {
    const segment = buildDashboardBreadcrumbSegment({
      page: "2",
      tab: "pieces",
      pcSort: ["ignored"],
    });

    expect(segment.linkProps.href).toBe("/case_files?page=2&tab=pieces");
  });
});

describe("buildCaseFileBreadcrumbSegment", () => {
  const caseFile = {
    caseFileNumber: "TA069/2024/001",
    title: "Recours DAHO",
    litigationType: "REFERE" as const,
    rightType: "HEBERGEMENT" as const,
    summary: "Requête DALO",
    caseFileActors: mainClaimantCaseFileActors(),
  };

  it("builds a case file link with encoded path and label", () => {
    const segment = buildCaseFileBreadcrumbSegment(caseFile, {});

    expect(segment.label).toBe(
      "TA069/2024/001 - Recours DAHO - Dupont Jean - Référé - H (Requête DALO)",
    );
    expect(segment.linkProps.href).toBe("/case_files/TA069%2F2024%2F001#case-file-details");
  });

  it("preserves carried search params in the case file link", () => {
    const segment = buildCaseFileBreadcrumbSegment(caseFile, { tab: "pieces", pcSort: "date" });

    expect(segment.linkProps.href).toBe(
      "/case_files/TA069%2F2024%2F001?tab=pieces&pcSort=date#case-file-details",
    );
  });
});

describe("CaseFileBreadcrumb", () => {
  const caseFile = {
    caseFileNumber: "TA069-2026-001",
    title: "Requête DALO",
    litigationType: "INJONCTION" as const,
    rightType: "LOGEMENT" as const,
    summary: "Urgence familiale",
    caseFileActors: mainClaimantCaseFileActors(),
  };

  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard link and current case file label", () => {
    render(<CaseFileBreadcrumb caseFile={caseFile} searchParams={{}} />);

    expect(screen.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")).toBe(
      "/case_files",
    );
    expect(
      screen.getByText(
        "TA069-2026-001 - Requête DALO - Dupont Jean - Injonction - L (Urgence familiale)",
      ),
    ).toBeTruthy();
  });

  it("carries search params on the dashboard link", () => {
    render(
      <CaseFileBreadcrumb
        caseFile={{
          ...caseFile,
          litigationType: null,
          rightType: null,
          summary: null,
        }}
        searchParams={{ page: "2", tab: "pieces" }}
      />,
    );

    expect(screen.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")).toBe(
      "/case_files?page=2&tab=pieces",
    );
  });

  it("renders trailing segments and a custom current page label", () => {
    render(
      <CaseFileBreadcrumb
        caseFile={caseFile}
        searchParams={{ tab: "pieces" }}
        currentPageLabel="Pièce 1"
        trailingSegments={[
          {
            label: "TA069-2026-001 - Requête DALO - Dupont Jean - Injonction - L (Urgence familiale)",
            linkProps: { href: "/case_files/TA069-2026-001?tab=pieces" },
          },
        ]}
      />,
    );

    expect(
      screen
        .getByRole("link", {
          name: "TA069-2026-001 - Requête DALO - Dupont Jean - Injonction - L (Urgence familiale)",
        })
        .getAttribute("href"),
    ).toBe("/case_files/TA069-2026-001?tab=pieces");
    expect(screen.getByText("Pièce 1")).toBeTruthy();
  });
});
