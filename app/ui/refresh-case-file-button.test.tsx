import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RefreshCaseFileButton } from "./refresh-case-file-button";

// The button calls the `refreshCaseFile` server action and refreshes the router
// on success; both are mocked so the component can be tested in isolation.
const mockRefreshCaseFile = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("@/app/(protected)/case_files/[caseFileNumber]/actions", () => ({
  refreshCaseFile: (...args: unknown[]) => mockRefreshCaseFile(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

describe("RefreshCaseFileButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le bouton « Rafraîchir » à l'état initial", () => {
    render(<RefreshCaseFileButton caseFileNumber="TA069-2026-001" />);

    expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeTruthy();
  });

  it("appelle l'action avec le numéro de dossier et rafraîchit le router en cas de succès", async () => {
    mockRefreshCaseFile.mockResolvedValue({ ok: true });
    render(<RefreshCaseFileButton caseFileNumber="TA069-2026-001" />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRefreshCaseFile).toHaveBeenCalledWith("TA069-2026-001");
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Dossier rafraîchi avec succès/)).toBeTruthy();
  });

  it("affiche une alerte d'erreur et ne rafraîchit pas le router en cas d'échec", async () => {
    mockRefreshCaseFile.mockResolvedValue({ ok: false, error: "Timeout Télérecours" });
    render(<RefreshCaseFileButton caseFileNumber="TA069-2026-001" />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText(/Échec du rafraîchissement : Timeout Télérecours/)).toBeTruthy();
    });
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });
});
