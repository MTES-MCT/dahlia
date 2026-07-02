import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  CaseFileBreadcrumb,
  caseFileLabel,
  buildDashboardBreadcrumbSegment,
  buildCaseFileBreadcrumbSegment,
} from "./case-file-breadcrumb";

describe("caseFileLabel", () => {
  it("concatenates case file number and title when title is set", () => {
    expect(caseFileLabel({ caseFileNumber: "TA069-2026-001", title: "Requête DALO" })).toBe(
      "TA069-2026-001 - Requête DALO",
    );
  });

  it("returns only the case file number when title is null", () => {
    expect(caseFileLabel({ caseFileNumber: "TA069-2026-001", title: null })).toBe("TA069-2026-001");
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
  const caseFile = { caseFileNumber: "TA069/2024/001", title: "Requête DALO" };

  it("builds a case file link with encoded path and label", () => {
    const segment = buildCaseFileBreadcrumbSegment(caseFile, {});

    expect(segment.label).toBe("TA069/2024/001 - Requête DALO");
    expect(segment.linkProps.href).toBe("/case_files/TA069%2F2024%2F001");
  });

  it("preserves carried search params in the case file link", () => {
    const segment = buildCaseFileBreadcrumbSegment(caseFile, { tab: "pieces", pcSort: "date" });

    expect(segment.linkProps.href).toBe("/case_files/TA069%2F2024%2F001?tab=pieces&pcSort=date");
  });
});

describe("CaseFileBreadcrumb", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard link and current case file label", () => {
    render(
      <CaseFileBreadcrumb
        caseFile={{ caseFileNumber: "TA069-2026-001", title: "Requête DALO" }}
        searchParams={{}}
      />,
    );

    expect(screen.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")).toBe(
      "/case_files",
    );
    expect(screen.getByText("TA069-2026-001 - Requête DALO")).toBeTruthy();
  });

  it("carries search params on the dashboard link", () => {
    render(
      <CaseFileBreadcrumb
        caseFile={{ caseFileNumber: "TA069-2026-001", title: null }}
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
        caseFile={{ caseFileNumber: "TA069-2026-001", title: "Requête DALO" }}
        searchParams={{ tab: "pieces" }}
        currentPageLabel="Pièce 1"
        trailingSegments={[
          {
            label: "TA069-2026-001 - Requête DALO",
            linkProps: { href: "/case_files/TA069-2026-001?tab=pieces" },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "TA069-2026-001 - Requête DALO" }).getAttribute("href"),
    ).toBe("/case_files/TA069-2026-001?tab=pieces");
    expect(screen.getByText("Pièce 1")).toBeTruthy();
  });
});
