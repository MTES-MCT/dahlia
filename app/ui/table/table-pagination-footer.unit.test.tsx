import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TablePaginationFooter } from "./table-pagination-footer";

const baseProps = {
  pageSize: 10 as const,
  currentPage: 1,
  totalPages: 1,
  onPageSizeChange: vi.fn(),
  getPageLinkProps: (pageNumber: number) => ({ href: `?page=${pageNumber}`, scroll: false }),
};

describe("TablePaginationFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le sélecteur de taille de page", () => {
    render(<TablePaginationFooter {...baseProps} />);

    expect(screen.getByLabelText("Résultats par page")).toBeTruthy();
  });

  it("masque la pagination quand il n'y a qu'une seule page", () => {
    render(<TablePaginationFooter {...baseProps} totalPages={1} />);

    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("affiche la pagination et construit les liens via getPageLinkProps", () => {
    render(<TablePaginationFooter {...baseProps} totalPages={3} />);

    const page2Link = screen.getByRole("link", { name: "2" });
    expect(page2Link.getAttribute("href")).toBe("?page=2");
  });

  it("appelle onPageSizeChange lors du changement de taille", () => {
    const onPageSizeChange = vi.fn();
    render(<TablePaginationFooter {...baseProps} onPageSizeChange={onPageSizeChange} />);

    fireEvent.change(screen.getByLabelText("Résultats par page"), { target: { value: "30" } });

    expect(onPageSizeChange).toHaveBeenCalledWith(30);
  });
});
