import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { PiecesWorkspace, type WorkspacePiece } from "./pieces-workspace";
import {
  savePieceMetadataAction,
  setPieceFavoriteAction,
} from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions";

vi.mock(
  "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions",
  () => ({
    savePieceMetadataAction: vi.fn(),
    setPieceFavoriteAction: vi.fn(),
  }),
);

const pieces: WorkspacePiece[] = [
  {
    encodedFileId: "f1",
    fileName: "requete.pdf",
    dahliaName: "Requête introductive",
    comment: "À vérifier",
    isFavorite: false,
    typeLabel: "Requête",
    eventDate: "12/03/2026",
    dataUrl: "/data/f1",
    viewerMimeType: "application/pdf",
  },
  {
    encodedFileId: "f2",
    fileName: "annexe.pdf",
    dahliaName: null,
    comment: null,
    isFavorite: false,
    typeLabel: "Mémoire",
    eventDate: "",
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

function groupNames(): string[] {
  return within(sidebar())
    .getAllByRole("region")
    .map((region) => region.getAttribute("aria-labelledby") ?? "")
    .map((id) => document.getElementById(id)?.textContent ?? "");
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
    expect(within(nav).getByRole("button", { name: /^Requête introductive/ })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: /^annexe\.pdf/ })).toBeTruthy();
  });

  it("affiche dans la liste le nom de fichier et la date de l'événement de la pièce", () => {
    renderWorkspace();
    const button = within(sidebar()).getByRole("button", { name: /^Requête introductive/ });
    expect(within(button).getByText("requete.pdf")).toBeTruthy();
    expect(within(button).getByText("12/03/2026")).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: /^annexe\.pdf/ }));

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

  it("change de pièce avec les flèches haut et bas du clavier", () => {
    renderWorkspace();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();
    // Already on the last pièce: nothing changes.
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("change de pièce avec les flèches droite et gauche du clavier", () => {
    renderWorkspace();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("ignore les flèches du clavier pendant la saisie dans un champ", () => {
    vi.mocked(savePieceMetadataAction).mockResolvedValue({ ok: true });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Éditer/ }));

    fireEvent.keyDown(within(editModal()).getByLabelText("Nom sur DAHLIA"), { key: "ArrowDown" });
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

  it("marque une pièce comme favori depuis la liste et la remonte dans « Favoris »", async () => {
    vi.mocked(setPieceFavoriteAction).mockResolvedValue({ ok: true });
    renderWorkspace();
    expect(groupNames()).toEqual(["Autres pièces · 2"]);

    const star = screen.getByRole("button", { name: "Marquer comme favori : annexe.pdf" });
    expect(star.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(star);

    expect(setPieceFavoriteAction).toHaveBeenCalledWith(
      { jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" },
      "f2",
      true,
    );
    expect(groupNames()).toEqual(["Favoris · 1", "Autres pièces · 1"]);
    const favorites = within(sidebar()).getAllByRole("list")[0];
    expect(within(favorites).getByRole("button", { name: /^annexe\.pdf/ })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Retirer des favoris : annexe.pdf" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await vi.waitFor(() => expect(setPieceFavoriteAction).toHaveBeenCalledTimes(1));
  });

  it("affiche par défaut le premier favori, puis navigue dans l'ordre affiché", () => {
    render(
      <PiecesWorkspace
        caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
        pieces={[pieces[0], { ...pieces[1], isFavorite: true }]}
      />,
    );
    // The favorite is listed (and shown) first, before the server's first pièce.
    expect(screen.getByRole("heading", { name: "annexe.pdf" })).toBeTruthy();
    expect(screen.getByText("Favori")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Pièce précédente" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pièce suivante" }));
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("affiche la pièce demandée par initialPieceId plutôt que le premier favori", () => {
    render(
      <PiecesWorkspace
        caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
        pieces={[pieces[0], { ...pieces[1], isFavorite: true }]}
        initialPieceId="f1"
      />,
    );
    expect(screen.getByRole("heading", { name: "Requête introductive" })).toBeTruthy();
  });

  it("annule le favori quand l'enregistrement échoue", async () => {
    vi.mocked(setPieceFavoriteAction).mockResolvedValue({ ok: false, error: "Pièce introuvable." });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Marquer comme favori : annexe.pdf" }));

    expect(await screen.findByText(/Pièce introuvable\./)).toBeTruthy();
    expect(groupNames()).toEqual(["Autres pièces · 2"]);
  });

  it("marque la pièce comme favori depuis la modale d'édition", async () => {
    vi.mocked(savePieceMetadataAction).mockResolvedValue({ ok: true });
    renderWorkspace();
    expect(screen.queryByText("Favori")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Éditer/ }));
    const checkbox = within(editModal()).getByLabelText(/^Favori/) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    fireEvent.click(within(editModal()).getByRole("button", { name: /Enregistrer/ }));

    expect(await screen.findByText("Favori")).toBeTruthy();
    expect(savePieceMetadataAction).toHaveBeenCalledWith(
      { jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" },
      "f1",
      expect.objectContaining({ isFavorite: true }),
    );
    expect(groupNames()).toEqual(["Favoris · 1", "Autres pièces · 1"]);
  });

  describe("défilement de la liste des pièces", () => {
    // jsdom has no layout: list rows are stacked 50px high in a 100px-high list.
    let scrollTop: number;

    beforeEach(() => {
      scrollTop = 0;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element,
      ) {
        const rect = (top: number, height: number) =>
          ({ top, bottom: top + height, height }) as DOMRect;
        if (this.id === "pieces-list-scroll") return rect(0, 100);
        const rows = Array.from(document.querySelectorAll("#pieces-list-scroll li"));
        const index = rows.indexOf(this);
        return index >= 0 ? rect(index * 50 - scrollTop, 50) : rect(0, 0);
      });
      Object.defineProperty(HTMLElement.prototype, "scrollTop", {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.max(0, value);
        },
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete (HTMLElement.prototype as { scrollTop?: number }).scrollTop;
    });

    const manyPieces: WorkspacePiece[] = Array.from({ length: 6 }, (_, index) => ({
      ...pieces[1],
      encodedFileId: `p${index}`,
      fileName: `piece-${index}.pdf`,
    }));

    it("fait défiler la liste pour montrer la pièce affichée à l'arrivée", () => {
      render(
        <PiecesWorkspace
          caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
          pieces={manyPieces}
          initialPieceId="p4"
        />,
      );
      // Row 4 (top 200, centre 225) centred in the 100px list.
      expect(scrollTop).toBe(175);
    });

    it("ne fait pas défiler la liste quand la pièce est déjà visible", () => {
      render(
        <PiecesWorkspace
          caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
          pieces={manyPieces}
          initialPieceId="p1"
        />,
      );
      expect(scrollTop).toBe(0);
    });

    it("garde la pièce visible pendant la navigation au clavier", () => {
      render(
        <PiecesWorkspace
          caseFileKey={{ jurisdictionCode: "TA069", caseFileNumber: "TA069-2026-001" }}
          pieces={manyPieces}
        />,
      );
      fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(scrollTop).toBe(0);
      fireEvent.keyDown(window, { key: "ArrowDown" });
      // Row 2 (bottom 150) aligned on the list bottom.
      expect(scrollTop).toBe(50);
    });
  });
});
