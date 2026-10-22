import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { PiecesWorkspace, type WorkspacePiece } from "./pieces-workspace";
import { savePieceMetadataAction } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions";

vi.mock(
  "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions",
  () => ({
    savePieceMetadataAction: vi.fn(),
  }),
);

const pieces: WorkspacePiece[] = [
  {
    encodedFileId: "f1",
    fileName: "requete.pdf",
    dahliaName: "Requête introductive",
    comment: "À vérifier",
    typeLabel: "Requête",
    dataUrl: "/data/f1",
    viewerMimeType: "application/pdf",
  },
  {
    encodedFileId: "f2",
    fileName: "annexe.pdf",
    dahliaName: null,
    comment: null,
    typeLabel: "Mémoire",
    dataUrl: "/data/f2",
    viewerMimeType: "application/pdf",
  },
];

function renderWorkspace() {
  return render(
    <PiecesWorkspace
      caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
      pieces={pieces}
    />,
  );
}

// DSFR modals rely on window.dsfr(...).modal.disclose/conceal at runtime.
function mockDsfrModalApi() {
  (
    window as unknown as {
      dsfr: (element: HTMLElement) => { modal: { disclose: () => void; conceal: () => void } };
    }
  ).dsfr = (element: HTMLElement) => ({
    modal: {
      disclose: () => element.setAttribute("open", ""),
      conceal: () => element.removeAttribute("open"),
    },
  });
}

function editModal(): HTMLElement {
  return document.getElementById("piece-edit-modal") as HTMLElement;
}

function sidebar() {
  return screen.getByRole("navigation", { name: "Liste des pièces" });
}

describe("PiecesWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDsfrModalApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("liste toutes les pièces avec le libellé DAHLIA ou le nom original", () => {
    renderWorkspace();
    const nav = sidebar();
    expect(within(nav).getByRole("button", { name: /Requête introductive/ })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: /annexe\.pdf/ })).toBeTruthy();
  });

  it("affiche la première pièce dans le panneau de détail par défaut", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
    expect(screen.getByText("À vérifier")).toBeTruthy();
  });

  it("affiche d'abord la pièce demandée par initialPieceId", () => {
    render(
      <PiecesWorkspace
        caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
        pieces={pieces}
        initialPieceId="f2"
      />,
    );
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();
  });

  it("revient à la première pièce quand initialPieceId est inconnu", () => {
    render(
      <PiecesWorkspace
        caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
        pieces={pieces}
        initialPieceId="inconnue"
      />,
    );
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("sélectionne uniquement la pièce cliquée et l'affiche à droite", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /annexe\.pdf/ }));

    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();

    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // "Tout sélectionner" + une case par pièce.
    const checked = boxes.filter((box) => box.checked);
    expect(checked).toHaveLength(1);
  });

  it("coche/décoche toutes les pièces via la case « Tout sélectionner »", () => {
    renderWorkspace();
    const selectAll = screen.getByLabelText("Tout sélectionner") as HTMLInputElement;

    fireEvent.click(selectAll);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((box) => box.checked)).toBe(true);
  });

  it("affiche le nom de fichier Télérecours sous le nom DAHLIA", () => {
    renderWorkspace();
    const heading = screen.getByRole("heading", { name: "Requête introductive" });
    expect(heading.nextElementSibling?.textContent).toBe("requete.pdf");
  });

  it("navigue vers la pièce suivante puis précédente avec les flèches", () => {
    renderWorkspace();
    const previous = screen.getByRole("button", { name: "Pièce précédente" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Pièce suivante" }));
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Pièce suivante" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Pièce précédente" }));
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("ouvre la pièce dans un nouvel onglet", () => {
    renderWorkspace();
    const link = screen.getByRole("link", { name: /Afficher/ });
    expect(link.getAttribute("href")).toBe("/data/f1");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("affiche « Aucun commentaire » quand la pièce n'en a pas", () => {
    renderWorkspace();
    expect(screen.queryByText("Aucun commentaire")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pièce suivante" }));
    expect(screen.getByText("Aucun commentaire")).toBeTruthy();
  });

  it("édite la pièce dans une modale puis enregistre les métadonnées", async () => {
    vi.mocked(savePieceMetadataAction).mockResolvedValue({ ok: true });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Éditer/ }));
    const dialog = editModal();
    expect(dialog.hasAttribute("open")).toBe(true);

    const input = within(dialog).getByLabelText("Nom sur DAHLIA") as HTMLInputElement;
    expect(input.value).toBe("Requête introductive");
    fireEvent.change(input, { target: { value: "Nouveau nom" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Enregistrer/ }));

    await screen.findByRole("heading", { name: "Nouveau nom" });
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(savePieceMetadataAction).toHaveBeenCalledWith(
      { jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" },
      "f1",
      expect.objectContaining({ dahliaName: "Nouveau nom" }),
    );
  });
});
