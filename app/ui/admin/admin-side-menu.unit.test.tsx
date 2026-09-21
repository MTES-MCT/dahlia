import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AdminSideMenu } from "./admin-side-menu";

const mockUsePathname = vi.fn(() => "/admin/users");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("AdminSideMenu", () => {
  afterEach(() => {
    cleanup();
    mockUsePathname.mockReturnValue("/admin/users");
  });

  it("affiche les liens Utilisateurs, Juridiction, Divisions et Mots-clés", () => {
    const { container } = render(<AdminSideMenu />);

    const usersLink = container.querySelector('a[href="/admin/users"]');
    const jurisdictionLink = container.querySelector('a[href="/admin/jurisdiction"]');
    const divisionsLink = container.querySelector('a[href="/admin/divisions"]');
    const tagsLink = container.querySelector('a[href="/admin/tags"]');

    expect(usersLink?.textContent).toContain("Utilisateurs");
    expect(jurisdictionLink?.textContent).toContain("Juridiction");
    expect(divisionsLink?.textContent).toContain("Divisions");
    expect(tagsLink?.textContent).toContain("Mots-clés");
  });

  it("marque Utilisateurs comme actif sur /admin/users", () => {
    mockUsePathname.mockReturnValue("/admin/users");
    const { container } = render(<AdminSideMenu />);

    expect(container.querySelector('a[href="/admin/users"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      container.querySelector('a[href="/admin/jurisdiction"]')?.getAttribute("aria-current"),
    ).toBeNull();
    expect(
      container.querySelector('a[href="/admin/divisions"]')?.getAttribute("aria-current"),
    ).toBeNull();
    expect(
      container.querySelector('a[href="/admin/tags"]')?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marque Juridiction comme actif sur /admin/jurisdiction", () => {
    mockUsePathname.mockReturnValue("/admin/jurisdiction");
    const { container } = render(<AdminSideMenu />);

    expect(
      container.querySelector('a[href="/admin/jurisdiction"]')?.getAttribute("aria-current"),
    ).toBe("page");
  });

  it("marque Divisions comme actif sur /admin/divisions", () => {
    mockUsePathname.mockReturnValue("/admin/divisions");
    const { container } = render(<AdminSideMenu />);

    expect(
      container.querySelector('a[href="/admin/divisions"]')?.getAttribute("aria-current"),
    ).toBe("page");
  });

  it("marque Mots-clés comme actif sur /admin/tags", () => {
    mockUsePathname.mockReturnValue("/admin/tags");
    const { container } = render(<AdminSideMenu />);

    expect(container.querySelector('a[href="/admin/tags"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
  });
});
