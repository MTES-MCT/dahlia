import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TableSearch } from "./table-search";
import { type TableParamNames } from "@/app/lib/case-file-search";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/case_files/123",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

const PARAMS: TableParamNames = {
  page: "objetPage",
  sortBy: "objetSortBy",
  sortOrder: "objetSortOrder",
  query: "objetq",
};

function getForm(): HTMLFormElement {
  return screen.getByRole("search") as HTMLFormElement;
}

function hiddenValue(form: HTMLFormElement, name: string): string | undefined {
  const field = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  return field?.value;
}

describe("TableSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("est un form GET vers le pathname courant", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    render(<TableSearch params={PARAMS} label="Rechercher" />);

    const form = getForm();
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/case_files/123");
  });

  it("pré-remplit le champ de recherche avec la valeur courante", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ objetq: "dupont" }) as never);
    render(<TableSearch params={PARAMS} label="Rechercher" />);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.name).toBe("objetq");
    expect(input.value).toBe("dupont");
  });

  it("reporte les autres params en champs cachés mais ni la recherche ni la page", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        objetq: "dupont",
        objetPage: "3",
        tab: "hearings",
        objetSortBy: "date",
      }) as never,
    );
    render(<TableSearch params={PARAMS} label="Rechercher" />);

    const form = getForm();
    expect(hiddenValue(form, "tab")).toBe("hearings");
    expect(hiddenValue(form, "objetSortBy")).toBe("date");
    // The search input owns objetq; page is dropped to reset to page 1.
    expect(hiddenValue(form, "objetq")).toBeUndefined();
    expect(hiddenValue(form, "objetPage")).toBeUndefined();
  });

  it("réinitialise en supprimant la recherche et la page, en gardant les autres params", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ objetq: "dupont", objetPage: "3", tab: "hearings" }) as never,
    );
    render(<TableSearch params={PARAMS} label="Rechercher" />);

    fireEvent.click(screen.getByRole("button", { name: /Ré-initialiser la recherche/ }));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("tab=hearings");
    expect(pushedUrl).not.toContain("objetq=");
    expect(pushedUrl).not.toContain("objetPage=");
  });

  it("vide le champ de recherche après la navigation de réinitialisation", () => {
    // The field is uncontrolled and remounted via its `key`, so it clears on the
    // navigation triggered by reset (here simulated by a re-render with the query
    // param removed), not synchronously on click.
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ objetq: "dupont" }) as never);
    const { rerender } = render(<TableSearch params={PARAMS} label="Rechercher" />);

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("dupont");

    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    rerender(<TableSearch params={PARAMS} label="Rechercher" />);

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("pousse vers « ? » quand aucun autre param ne subsiste à la réinitialisation", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ objetq: "dupont" }) as never);
    render(<TableSearch params={PARAMS} label="Rechercher" />);

    fireEvent.click(screen.getByRole("button", { name: /Ré-initialiser la recherche/ }));

    expect(mockPush).toHaveBeenCalledWith("?", { scroll: false });
  });
});
