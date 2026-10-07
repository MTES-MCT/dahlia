import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import {
  CaseFileTelerecoursSync,
  formatTelerecoursSyncError,
  telerecoursSyncPath,
} from "./case-file-telerecours-sync";

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
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("affiche la date de dernière synchronisation Télérecours", () => {
    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-DATE"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    expect(screen.getByText("Dernière synchronisation le 15/07/2024 à 12h30")).toBeTruthy();
  });

  it("indique l'absence de synchronisation Télérecours lorsque la date est inconnue", () => {
    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-NULL"
        telerecoursSyncAt={null}
      />,
    );

    expect(screen.getByText("Aucune synchronisation Télérecours")).toBeTruthy();
  });

  it("relance la synchronisation Télérecours à l'affichage et rafraîchit le router en cas de succès", async () => {
    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-SUCCESS"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(telerecoursSyncPath("TA069", "TA069-SYNC-SUCCESS"), {
        method: "POST",
      });
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("affiche une erreur sans rafraîchir le router en cas d'échec", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: false, error: "Timeout Télérecours" }));

    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-ERROR"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Échec de la synchronisation")).toBeTruthy();
    });
    expect(screen.queryByText(/Timeout Télérecours/)).toBeNull();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it("masque le texte d'une exception réseau", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('column "telerecoursSyncAt" does not exist'));

    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-NETWORK"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Échec de la synchronisation")).toBeTruthy();
    });
    expect(screen.queryByText(/telerecoursSyncAt/)).toBeNull();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it("n'ajoute pas une seconde fois le préfixe lorsque le serveur a déjà formaté l'erreur", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const formatted =
      "Échec de la synchronisation : Error: GET https://administrations.telerecours.fr/api/case-file/1";
    mockFetch.mockResolvedValue(jsonResponse({ ok: false, error: formatted }));

    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-ERROR-PREFIX"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(formatted)).toBeTruthy();
    });
    expect(
      screen.queryByText(/Échec de la synchronisation : Échec de la synchronisation/),
    ).toBeNull();
  });

  it("masque un message déjà formaté en dehors du développement", () => {
    expect(
      formatTelerecoursSyncError(
        "Échec de la synchronisation : Error: GET https://administrations.telerecours.fr/api/case-file/1",
      ),
    ).toBe("Échec de la synchronisation");
  });

  it("affiche le détail de l'erreur en environnement de développement", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockFetch.mockResolvedValue(jsonResponse({ ok: false, error: "Timeout Télérecours" }));

    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
        caseFileNumber="TA069-SYNC-ERROR-DEV"
        telerecoursSyncAt={new Date("2024-07-15T10:30:00Z")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Échec de la synchronisation : Timeout Télérecours")).toBeTruthy();
    });
  });

  it("affiche l'état de synchronisation tant que l'action n'a pas répondu", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(
      <CaseFileTelerecoursSync
        jurisdictionCode="TA069"
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
