import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFilesSearchBar } from "./case-files-search-bar";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

function getInput(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

describe("CaseFilesSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("pré-remplit le champ avec la valeur courante de q", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ q: "dupont" }) as never);
    render(<CaseFilesSearchBar />);

    expect(getInput().defaultValue).toBe("dupont");
  });

  it("ajoute q dans l'URL et supprime page au clic", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ page: "3" }) as never);
    render(<CaseFilesSearchBar />);

    const input = getInput();
    input.value = "martin";
    fireEvent.click(screen.getByRole("button"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("q=martin");
    expect(pushedUrl).not.toContain("page=");
  });

  it("conserve les autres paramètres URL existants", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ sortBy: "caseFileNumber", sortOrder: "ascending" }) as never,
    );
    render(<CaseFilesSearchBar />);

    const input = getInput();
    input.value = "curie";
    fireEvent.click(screen.getByRole("button"));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("sortBy=caseFileNumber");
    expect(pushedUrl).toContain("sortOrder=ascending");
    expect(pushedUrl).toContain("q=curie");
  });

  it("supprime q quand la requête est vide", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ q: "dupont", page: "2" }) as never,
    );
    render(<CaseFilesSearchBar />);

    const input = getInput();
    input.value = "";
    fireEvent.click(screen.getByRole("button"));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).not.toContain("q=");
    expect(pushedUrl).not.toContain("page=");
  });

  it("trim les espaces autour de la requête", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    render(<CaseFilesSearchBar />);

    const input = getInput();
    input.value = "   dupont  ";
    fireEvent.click(screen.getByRole("button"));

    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("q=dupont");
    expect(pushedUrl).not.toContain("%20");
  });
});
