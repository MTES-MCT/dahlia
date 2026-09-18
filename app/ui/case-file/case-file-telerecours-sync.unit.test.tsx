import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CaseFileTelerecoursSync } from "./case-file-telerecours-sync";

const mockRefreshCaseFile = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("@/app/(protected)/case_files/[caseFileNumber]/actions", () => ({
  refreshCaseFile: (...args: unknown[]) => mockRefreshCaseFile(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

describe("CaseFileTelerecoursSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshCaseFile.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche la date de dernière synchronisation Télérecours", () => {
    render(
      <CaseFileTelerecoursSync
        caseFileNumber="TA069-SYNC-DATE"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    expect(screen.getByText("Dernière synchronisation le 15/07/2024 à 12h30")).toBeTruthy();
  });

  it("indique l'absence de synchronisation Télérecours lorsque la date est inconnue", () => {
    render(<CaseFileTelerecoursSync caseFileNumber="TA069-SYNC-NULL" telerecoursSyncAt={null} />);

    expect(screen.getByText("Aucune synchronisation Télérecours")).toBeTruthy();
  });

  it("relance la synchronisation Télérecours à l'affichage et rafraîchit le router en cas de succès", async () => {
    render(
      <CaseFileTelerecoursSync
        caseFileNumber="TA069-SYNC-SUCCESS"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(mockRefreshCaseFile).toHaveBeenCalledWith("TA069-SYNC-SUCCESS");
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("affiche une erreur sans rafraîchir le router en cas d'échec", async () => {
    mockRefreshCaseFile.mockResolvedValue({ ok: false, error: "Timeout Télérecours" });

    render(
      <CaseFileTelerecoursSync
        caseFileNumber="TA069-SYNC-ERROR"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Échec de la synchronisation : Timeout Télérecours")).toBeTruthy();
    });
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it("affiche l'état de synchronisation tant que l'action n'a pas répondu", async () => {
    mockRefreshCaseFile.mockReturnValue(new Promise(() => {}));

    render(
      <CaseFileTelerecoursSync
        caseFileNumber="TA069-SYNC-PENDING"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Synchronisation…")).toBeTruthy();
    });
    expect(screen.getByText("Dernière synchronisation le 15/07/2024 à 12h30")).toBeTruthy();
  });
});
