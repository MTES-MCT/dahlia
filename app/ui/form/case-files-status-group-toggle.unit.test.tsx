import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CaseFilesStatusGroupToggle } from "./case-files-status-group-toggle";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/case_files",
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from "next/navigation";

function setSearchParams(init: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(init) as never);
}

describe("CaseFilesStatusGroupToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("dahliaq=statut:Terminé&page=2");
  });

  afterEach(() => {
    cleanup();
  });

  it("navigue vers le nouveau groupe en conservant tri et recherche", () => {
    render(<CaseFilesStatusGroupToggle currentGroup="en_cours" />);

    fireEvent.click(screen.getByLabelText("Terminé"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(mockPush.mock.calls[0][0] as string);
    expect(url).toContain("groupe=termine");
    expect(url).toContain("dahliaq=statut:Terminé");
    expect(url).not.toContain("page=");
  });

  it("retire une facette statut incompatible avec le groupe cible", () => {
    render(<CaseFilesStatusGroupToggle currentGroup="termine" />);

    fireEvent.click(screen.getByLabelText("En cours"));

    const url = decodeURIComponent(mockPush.mock.calls[0][0] as string);
    expect(url).toContain("groupe=en_cours");
    expect(url).not.toContain("statut:");
  });
});
