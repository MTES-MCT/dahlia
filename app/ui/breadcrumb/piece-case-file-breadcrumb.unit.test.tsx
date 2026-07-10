import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PieceCaseFileBreadcrumb } from "./piece-case-file-breadcrumb";

describe("PieceCaseFileBreadcrumb", () => {
  afterEach(() => {
    cleanup();
  });

  const caseFile = { caseFileNumber: "TA069-2026-001", title: "Requête DALO" };

  it("renders dashboard, case file and piece labels with dahliaName", () => {
    render(
      <PieceCaseFileBreadcrumb
        piece={{
          dahliaName: "Pièce 1",
          fileName: "requete.pdf",
          caseFile,
        }}
        searchParams={{}}
      />,
    );

    expect(screen.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")).toBe(
      "/case_files",
    );
    expect(
      screen.getByRole("link", { name: "TA069-2026-001 - Requête DALO" }).getAttribute("href"),
    ).toBe("/case_files/TA069-2026-001#case-file-details");
    expect(screen.getByText("Pièce 1")).toBeTruthy();
  });

  it("falls back to fileName when dahliaName is null", () => {
    render(
      <PieceCaseFileBreadcrumb
        piece={{
          dahliaName: null,
          fileName: "requete.pdf",
          caseFile,
        }}
        searchParams={{}}
      />,
    );

    expect(screen.getByText("requete.pdf")).toBeTruthy();
  });

  it("carries search params on dashboard and case file links", () => {
    render(
      <PieceCaseFileBreadcrumb
        piece={{
          dahliaName: "Pièce 1",
          fileName: "requete.pdf",
          caseFile,
        }}
        searchParams={{ tab: "pieces", pcSort: "date" }}
      />,
    );

    expect(screen.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")).toBe(
      "/case_files?tab=pieces&pcSort=date",
    );
    expect(
      screen.getByRole("link", { name: "TA069-2026-001 - Requête DALO" }).getAttribute("href"),
    ).toBe("/case_files/TA069-2026-001?tab=pieces&pcSort=date#case-file-details");
  });
});
