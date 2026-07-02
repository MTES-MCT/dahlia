import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RowSelectionProvider, RowSelectionHeaderCheckbox } from "./row-selection";
import { PiecesDownloadBar } from "./pieces-download-bar";

const CASE_FILE_NUMBER = "TA069-2026-001";

// Render the download bar together with a header checkbox so tests can drive the
// selection through the real selection context.
function renderBar(allIds: string[]) {
  return render(
    <RowSelectionProvider allIds={allIds}>
      <RowSelectionHeaderCheckbox />
      <PiecesDownloadBar caseFileNumber={CASE_FILE_NUMBER} />
    </RowSelectionProvider>,
  );
}

function selectAll() {
  fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner" }));
}

function downloadButton() {
  return screen.getByRole("button", { name: /Télécharger les pièces/ }) as HTMLButtonElement;
}

describe("PiecesDownloadBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("désactive le bouton et l'indique quand aucune pièce n'est sélectionnée", () => {
    renderBar(["ENC-A"]);

    expect(downloadButton().disabled).toBe(true);
    expect(screen.getByText("Aucune pièce sélectionnée")).toBeTruthy();
  });

  it("affiche le nombre de pièces sélectionnées et active le bouton", () => {
    renderBar(["ENC-A", "ENC-B"]);

    selectAll();

    expect(screen.getByText("2 pièces sélectionnées")).toBeTruthy();
    expect(downloadButton().disabled).toBe(false);
  });

  it("télécharge les pièces sélectionnées via une requête GET avec les ids en query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["zip"]),
      headers: { get: () => 'attachment; filename="pieces.zip"' },
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderBar(["ENC-A", "ENC-B"]);
    selectAll();
    fireEvent.click(downloadButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`/case_files/${encodeURIComponent(CASE_FILE_NUMBER)}/pieces/download?`);
    expect(url).toContain("id=ENC-A");
    expect(url).toContain("id=ENC-B");
    // GET is the default method: no explicit method/body passed.
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("affiche une alerte en cas d'échec du téléchargement", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "Pièce introuvable",
    });
    vi.stubGlobal("fetch", fetchMock);

    renderBar(["ENC-A"]);
    selectAll();
    fireEvent.click(downloadButton());

    await waitFor(() =>
      expect(screen.getByText(/Échec du téléchargement : Pièce introuvable/)).toBeTruthy(),
    );
  });
});
