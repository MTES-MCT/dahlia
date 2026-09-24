import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CaseFileTelerecoursSync, telerecoursSyncPath } from "./case-file-telerecours-sync";

const mockRouterRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("CaseFileTelerecoursSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
      expect(mockFetch).toHaveBeenCalledWith(telerecoursSyncPath("TA069-SYNC-SUCCESS"), {
        method: "POST",
      });
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("affiche une erreur sans rafraîchir le router en cas d'échec", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: false, error: "Timeout Télérecours" }));

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
    mockFetch.mockReturnValue(new Promise(() => {}));

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
