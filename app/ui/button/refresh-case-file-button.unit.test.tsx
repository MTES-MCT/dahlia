import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { CaseFileDetail } from "@/app/lib/data/case-files";
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
  const mockCaseFile = {
    caseFileNumber: "TA069-2026-001",
    updatedAt: new Date("2024-06-01"),
    telerecoursSyncAt: new Date("2024-07-15T10:30:00Z"),
  } as NonNullable<CaseFileDetail>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le bouton « Rafraîchir » à l'état initial", () => {
    render(<RefreshCaseFileButton caseFile={mockCaseFile} />);

    expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeTruthy();
  });

  it("affiche la date de mise à jour et la date de dernière synchronisation Télérecours", () => {
    render(<RefreshCaseFileButton caseFile={mockCaseFile} />);

    expect(screen.getByText("Mise à jour le 01/06/2024")).toBeTruthy();
    expect(
      screen.getByText("Dernière synchronisation Télérecours le 15/07/2024 à 12h30"),
    ).toBeTruthy();
  });

  it("indique l'absence de synchronisation Télérecours lorsque la date est inconnue", () => {
    render(<RefreshCaseFileButton caseFile={{ ...mockCaseFile, telerecoursSyncAt: null }} />);

    expect(screen.getByText("Aucune synchronisation Télérecours")).toBeTruthy();
  });

  it("appelle l'action avec le numéro de dossier et rafraîchit le router en cas de succès", async () => {
    mockRefreshCaseFile.mockResolvedValue({ ok: true });
    render(<RefreshCaseFileButton caseFile={mockCaseFile} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRefreshCaseFile).toHaveBeenCalledWith("TA069-2026-001");
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Dossier rafraîchi avec succès/)).toBeTruthy();
  });

  it("affiche une alerte d'erreur et ne rafraîchit pas le router en cas d'échec", async () => {
    mockRefreshCaseFile.mockResolvedValue({ ok: false, error: "Timeout Télérecours" });
    render(<RefreshCaseFileButton caseFile={mockCaseFile} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText(/Échec du rafraîchissement : Timeout Télérecours/)).toBeTruthy();
    });
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });
});
