import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SortableColumnHeader } from "./sortable-column-header";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

describe("SortableColumnHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendu", () => {
    it("affiche le label dans le span et dans le bouton", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getAllByText("Numero")).toHaveLength(2);
    });

    it("affiche aria-sort none quand la colonne n'est pas active", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("none");
    });

    it("affiche aria-sort ascending quand la colonne est triee en ordre croissant", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "ascending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("ascending");
    });

    it("affiche aria-sort descending quand la colonne est triee en ordre decroissant", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "descending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("descending");
    });

    it("n'est pas actif quand sortBy correspond a une autre colonne", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "autreColonne", sortOrder: "ascending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("none");
    });

    it("inclut l'ordre croissant dans l'aria-label quand la colonne est active ascending", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "ascending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
        "Trier par Numero, ordre croissant",
      );
    });

    it("inclut l'ordre decroissant dans l'aria-label quand la colonne est active descending", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "descending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
        "Trier par Numero, ordre décroissant",
      );
    });

    it("n'inclut pas l'ordre dans l'aria-label quand la colonne est inactive", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Trier par Numero");
    });

    it("est actif avec son ordre par defaut quand aucun tri n'est defini dans l'URL", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(
        <SortableColumnHeader label="Date" sortKey="convocationDate" defaultOrder="ascending" />,
      );

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("ascending");
    });

    it("reste inactif quand un autre tri est explicitement defini malgre un defaultOrder", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "ascending" }) as never,
      );
      render(
        <SortableColumnHeader label="Date" sortKey="convocationDate" defaultOrder="ascending" />,
      );

      expect(screen.getByRole("button").getAttribute("aria-sort")).toBe("none");
    });
  });

  describe("comportement au clic", () => {
    it("definit sortBy et sortOrder=ascending quand la colonne est inactive", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      fireEvent.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("?sortBy=caseFileNumber&sortOrder=ascending");
    });

    it("bascule vers descending quand la colonne est active ascending", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "ascending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      fireEvent.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("?sortBy=caseFileNumber&sortOrder=descending");
    });

    it("bascule vers ascending quand la colonne est active descending", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "descending" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      fireEvent.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("?sortBy=caseFileNumber&sortOrder=ascending");
    });

    it("supprime le parametre page au clic", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ page: "3" }) as never);
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      fireEvent.click(screen.getByRole("button"));

      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).not.toContain("page=");
    });

    it("bascule vers descending au clic quand la colonne est le tri par defaut ascending", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(
        <SortableColumnHeader label="Date" sortKey="convocationDate" defaultOrder="ascending" />,
      );

      fireEvent.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("?sortBy=convocationDate&sortOrder=descending");
    });

    it("conserve les autres parametres URL existants", () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ search: "dupont", page: "2" }) as never,
      );
      render(<SortableColumnHeader label="Numero" sortKey="caseFileNumber" />);

      fireEvent.click(screen.getByRole("button"));

      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).toContain("search=dupont");
      expect(pushedUrl).not.toContain("page=");
    });
  });
});
