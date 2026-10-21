import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import {
  CaseFileQualificationPanel,
  type CaseFileQualificationPanelProps,
} from "./case-file-qualification-panel";

vi.mock("@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions", () => ({
  validateCaseFileQualificationFormAction: vi.fn(async () => ({ ok: true })),
}));

function renderPanel(overrides: Partial<CaseFileQualificationPanelProps> = {}) {
  render(
    <CaseFileQualificationPanel
      jurisdictionCode="TA069"
      caseFileNumber="2600001"
      statusLabel="Jugé"
      litigationType="INJONCTION"
      rightType="DALO"
      comDaloNumber="69-0042"
      comedDecisionDate={new Date("2026-03-12T00:00:00Z")}
      productionDeadlineType={null}
      productionDeadlineDate={null}
      tags={[{ id: 1, label: "Urgent", color: "pink-tuile" }]}
      availableTags={[{ id: 1, label: "Urgent", color: "pink-tuile" }]}
      reviewState="toReview"
      validatedAtLabel=""
      {...overrides}
    />,
  );
}

const SAVE_HINT =
  "En enregistrant, vous confirmez avoir vérifié les informations proposées automatiquement.";

describe("CaseFileQualificationPanel", () => {
  afterEach(() => {
    cleanup();
  });

  describe("à revoir après un passage du classifier", () => {
    it("est déplié avec l'avertissement et le texte d'aide", () => {
      renderPanel();

      expect(screen.getByRole("button", { name: "Replier" })).toBeTruthy();
      expect(screen.getByText(/Données générées automatiquement/)).toBeTruthy();
      expect(screen.getByText(SAVE_HINT)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    });

    it("propose dans l'avertissement un bouton qui soumet le formulaire", () => {
      renderPanel();

      const validate = screen.getByRole("button", {
        name: "Valider la qualification du dossier",
      }) as HTMLButtonElement;
      expect(validate.type).toBe("submit");
      expect(validate.form).toBe(document.querySelector("form"));
    });
  });

  describe("validé", () => {
    it("est replié avec le résumé, sans bandeau de validation au chargement", () => {
      renderPanel({ reviewState: "validated", validatedAtLabel: "14/10/2026 à 09h30" });

      expect(screen.getByRole("button", { name: "Afficher et éditer" })).toBeTruthy();
      expect(screen.queryByText(/Qualification revue et validée/)).toBeNull();
      expect(screen.queryByText(/Données générées automatiquement/)).toBeNull();
      expect(screen.getByText("Recours injonction", { selector: "b" })).toBeTruthy();
      expect(screen.getByText("ComDalo n° 69-0042")).toBeTruthy();
      expect(screen.getByText("COMED du 12/03/2026")).toBeTruthy();
    });

    it("n'affiche ni texte d'aide ni bouton « Fermer sans valider » une fois déplié", () => {
      renderPanel({ reviewState: "validated", validatedAtLabel: "14/10/2026 à 09h30" });

      fireEvent.click(screen.getByRole("button", { name: "Afficher et éditer" }));

      expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
      expect(screen.queryByText(SAVE_HINT)).toBeNull();
      expect(screen.queryByRole("button", { name: "Fermer sans valider" })).toBeNull();
    });
  });

  it("jamais classifié ni validé : replié, sans alerte", () => {
    renderPanel({ reviewState: "notReviewed", litigationType: null, rightType: null });

    expect(screen.getByRole("button", { name: "Afficher et éditer" })).toBeTruthy();
    expect(screen.queryByText(/Données générées automatiquement/)).toBeNull();
    expect(screen.queryByText(/Qualification revue et validée/)).toBeNull();
    expect(screen.queryByText(/Type de contentieux non renseigné/)).toBeNull();
    expect(screen.queryByText(/Droit opposable non renseigné/)).toBeNull();
  });

  it("n'affiche l'échéance à produire que pour un dossier en cours d'instruction", () => {
    renderPanel({ statusLabel: "En cours d'instruction" });
    expect(screen.getByText("Échéance à produire")).toBeTruthy();

    cleanup();
    renderPanel();
    expect(screen.queryByText("Échéance à produire")).toBeNull();
  });

  it("propose le droit opposable dans un select dont l'option vide vaut « Non défini »", () => {
    renderPanel({ rightType: null });

    const select = screen.getByRole("combobox", { name: "Droit opposable" }) as HTMLSelectElement;
    expect(select.name).toBe("rightType");
    expect(select.value).toBe("");
    expect([...select.options].map((option) => [option.value, option.text])).toEqual([
      ["", ""],
      ["DALO", "DALO"],
      ["DAHO", "DAHO"],
      ["NI_DALO_NI_DAHO", expect.any(String)],
    ]);
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("affiche les mots-clés en badges dans le résumé", () => {
    renderPanel({ reviewState: "validated", validatedAtLabel: "14/10/2026 à 09h30" });

    const tagList = screen.getByRole("list", { name: "Tags du dossier" });
    expect(tagList.textContent).toBe("Urgent");
    expect(tagList.querySelector(".fr-badge")).toBeTruthy();
  });

  it("affiche l'échéance à produire et sa date dans le résumé", () => {
    renderPanel({
      reviewState: "validated",
      validatedAtLabel: "14/10/2026 à 09h30",
      productionDeadlineType: "MISE_EN_DEMEURE_DE_PRODUIRE",
      productionDeadlineDate: new Date("2026-11-12T00:00:00Z"),
    });

    expect(screen.getByText("Mise en demeure : 12/11/2026")).toBeTruthy();
  });

  it("laisse vide le libellé de l'option vide du type de contentieux", () => {
    renderPanel({ litigationType: null });

    const select = screen.getByRole("combobox", {
      name: "Type de contentieux",
    }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect([select.options[0].value, select.options[0].text]).toEqual(["", ""]);
  });

  describe("bandeau « Qualification revue et validée »", () => {
    function panel(overrides: Partial<CaseFileQualificationPanelProps>) {
      return (
        <CaseFileQualificationPanel
          jurisdictionCode="TA069"
          caseFileNumber="2600001"
          statusLabel="Jugé"
          litigationType="INJONCTION"
          rightType="DALO"
          comDaloNumber={null}
          comedDecisionDate={null}
          productionDeadlineType={null}
          productionDeadlineDate={null}
          tags={[]}
          availableTags={[]}
          reviewState="toReview"
          validatedAtLabel=""
          {...overrides}
        />
      );
    }

    it("apparaît après un enregistrement qui valide une revue en attente", async () => {
      const { rerender } = render(panel({ reviewState: "toReview" }));

      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
      // The revalidated page now reports the case file as validated.
      rerender(panel({ reviewState: "validated", validatedAtLabel: "16/10/2026 à 15h12" }));

      await waitFor(() =>
        expect(
          screen.getByText("Qualification revue et validée le 16/10/2026 à 15h12"),
        ).toBeTruthy(),
      );
      expect(screen.queryByText(/Données générées automatiquement/)).toBeNull();
    });

    it("n'apparaît pas après un enregistrement sans revue en attente", async () => {
      const { rerender } = render(
        panel({ reviewState: "validated", validatedAtLabel: "14/10/2026 à 09h30" }),
      );

      fireEvent.click(screen.getByRole("button", { name: "Afficher et éditer" }));
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
      rerender(panel({ reviewState: "validated", validatedAtLabel: "14/10/2026 à 09h30" }));

      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled,
        ).toBe(false),
      );
      expect(screen.queryByText(/Qualification revue et validée/)).toBeNull();
    });
  });

  it("dimensionne les champs à leur contenu plutôt qu'à toute la largeur", () => {
    renderPanel();

    expect(screen.getByRole("combobox", { name: "Type de contentieux" }).className).toContain(
      "w-max!",
    );
    expect(screen.getByRole("combobox", { name: "Droit opposable" }).className).toContain("w-max!");
    expect(screen.getByRole("textbox", { name: "Numéro ComDalo" }).className).toContain("max-w-64");
    expect(screen.getByLabelText("Date de la décision de la COMED").className).toContain(
      "max-w-48",
    );
  });

  it("signale « Qualification automatique à valider » sur les seuls champs à revoir", () => {
    renderPanel({ fieldsToReview: ["litigationType"] });

    const litigationGroup = screen
      .getByRole("combobox", { name: /Type de contentieux/ })
      .closest(".fr-select-group") as HTMLElement;
    const rightGroup = screen
      .getByRole("combobox", { name: /Droit opposable/ })
      .closest(".fr-select-group") as HTMLElement;

    expect(litigationGroup.className).toContain("fr-select-group--error");
    expect(litigationGroup.textContent).toContain("Qualification automatique à valider");
    expect(rightGroup.className).not.toContain("fr-select-group--error");
    expect(rightGroup.textContent).not.toContain("Qualification automatique à valider");
  });

  it("n'affiche aucun statut de champ quand rien n'est à revoir", () => {
    renderPanel({ reviewState: "validated", fieldsToReview: [] });

    expect(screen.queryByText("Qualification automatique à valider")).toBeNull();
  });

  it("désactive l'autocomplétion sur tous les champs, pour que Firefox ne restaure pas d'anciennes valeurs au rechargement", () => {
    // Under instruction and with a tag: renders the deadline fields and the
    // tag hidden inputs too.
    renderPanel({ statusLabel: "En cours d'instruction" });

    const form = document.querySelector("form") as HTMLFormElement;
    const controls = [...form.querySelectorAll("input, select, textarea")];
    expect(controls.length).toBeGreaterThan(8);
    const missing = controls
      .filter((control) => control.getAttribute("autocomplete") !== "off")
      .map((control) => control.getAttribute("name") ?? control.outerHTML);
    expect(missing).toEqual([]);
  });
});
