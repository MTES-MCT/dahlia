import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CaseFilesSearchFields, readFieldValues, buildQuery } from "./case-files-search-fields";
import { resolveFacetFieldValue, type FacetField } from "@/app/ui/button/column-filter-button";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";

const FACET_FIELDS: FacetField[] = [
  { key: "requerant", label: "Requérant" },
  { key: "statut", label: "Statut", options: ["En cours d'instruction", "Terminé"] },
  {
    key: "recours",
    label: "Type de recours",
    options: ["Recours en excès de pouvoir (REP)", "Référé"],
    optionAliases: { REP: "Recours en excès de pouvoir (REP)" },
  },
];

function renderFields(
  initialQuery: string,
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void = (event) => event.preventDefault(),
) {
  return render(
    <form role="search" onSubmit={onSubmit}>
      <CaseFilesSearchFields
        initialQuery={initialQuery}
        facetFields={FACET_FIELDS}
        name="dahliaq"
      />
      <button type="submit">Rechercher</button>
    </form>,
  );
}

function mainField(): HTMLInputElement {
  return screen.getByLabelText("Rechercher") as HTMLInputElement;
}

function details(): HTMLDetailsElement {
  const summary = screen.getByText(/Filtres avancés|Masquer les filtres avancés/);
  return summary.closest("details") as HTMLDetailsElement;
}

function openAdvancedPanel() {
  const panel = details();
  if (!panel.open) {
    panel.open = true;
    fireEvent(panel, new Event("toggle"));
  }
}

// Facet inputs live in the panel, which is closed by default.
function field(label: string): HTMLInputElement | HTMLSelectElement {
  openAdvancedPanel();
  return screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement | HTMLSelectElement;
}

describe("CaseFilesSearchFields", () => {
  afterEach(() => {
    cleanup();
  });

  it("pré-remplit le champ principal avec le texte libre et les filtres avancés avec les facettes", () => {
    renderFields('dupont requerant:prefet statut:"Terminé"');

    expect(mainField().value).toBe("dupont");
    expect(field("Requérant").value).toBe("prefet");
    expect(field("Statut").value).toBe("Terminé");
    expect(field("Type de recours").value).toBe("");
  });

  it("n'affiche plus de champ texte libre dans les filtres avancés", () => {
    renderFields("");

    expect(screen.queryByLabelText(/Recherché dans toutes les colonnes/)).toBeNull();
  });

  it("sélectionne l'option correspondant à une valeur saisie sans accent ni casse", () => {
    renderFields("statut:termine recours:rep");

    expect(field("Statut").value).toBe("Terminé");
    expect(field("Type de recours").value).toBe("Recours en excès de pouvoir (REP)");
  });

  it("soumet une seule requête combinant le texte libre et les facettes", () => {
    renderFields("dupont");

    fireEvent.change(mainField(), { target: { value: "durand" } });
    fireEvent.change(field("Statut"), { target: { value: "Terminé" } });
    fireEvent.change(field("Requérant"), { target: { value: "le prefet" } });

    const form = screen.getByRole("search") as HTMLFormElement;
    expect([...new FormData(form).entries()]).toEqual([
      ["dahliaq", 'durand requerant:"le prefet" statut:Terminé'],
    ]);
  });

  it("ne modifie pas les filtres avancés quand on tape dans le champ principal", () => {
    renderFields("requerant:prefet");

    fireEvent.change(mainField(), { target: { value: "durand" } });

    expect(mainField().value).toBe("durand");
    expect(field("Requérant").value).toBe("prefet");
  });

  it("compte uniquement les facettes dans le compteur des filtres avancés", () => {
    renderFields("dupont requerant:prefet statut:Terminé");

    expect(screen.getByText("Filtres avancés").textContent).toContain("2");
    expect(screen.getByText("filtres actifs", { exact: false })).toBeTruthy();
  });

  it("n'affiche pas de compteur pour une recherche en texte libre seul", () => {
    renderFields("dupont");

    expect(screen.getByText("Filtres avancés").textContent).toBe("Filtres avancés");
  });

  it("affiche chaque facette active comme un tag supprimable sous le champ principal", () => {
    renderFields("dupont requerant:prefet statut:Terminé");

    const group = screen.getByRole("group", { name: "Filtres actifs" });
    const tags = [...group.querySelectorAll("button.fr-tag--dismiss")];
    expect(tags.map((tag) => tag.textContent)).toEqual(["Requérant : prefet", "Statut : Terminé"]);
    expect(screen.getByRole("button", { name: "Retirer le filtre Statut : Terminé" })).toBeTruthy();
  });

  it("retire la facette et relance la recherche au clic sur son tag", () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return [...new FormData(event.currentTarget).entries()];
    });
    renderFields("dupont requerant:prefet statut:Terminé", onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Requérant : prefet" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.results[0].value).toEqual([["dahliaq", "dupont statut:Terminé"]]);
  });

  it("n'affiche pas de lien « Tout effacer »", () => {
    renderFields("requerant:prefet statut:Terminé");

    expect(screen.queryByText("Tout effacer")).toBeNull();
  });

  it("masque les tags des filtres actifs quand le panneau est ouvert", () => {
    renderFields("statut:Terminé");
    const panel = details();
    panel.open = true;
    fireEvent(panel, new Event("toggle"));

    expect(screen.queryByRole("group", { name: "Filtres actifs" })).toBeNull();
  });

  it("libelle le lien « Masquer les filtres avancés » quand le panneau est ouvert", () => {
    renderFields("");
    const panel = details();
    panel.open = true;
    fireEvent(panel, new Event("toggle"));

    expect(screen.getByText("Masquer les filtres avancés").tagName).toBe("SUMMARY");

    panel.open = false;
    fireEvent(panel, new Event("toggle"));

    expect(screen.getByText("Filtres avancés").tagName).toBe("SUMMARY");
  });

  it("referme les filtres avancés à la soumission du formulaire", () => {
    renderFields("");
    const panel = details();
    panel.open = true;
    fireEvent(panel, new Event("toggle"));
    expect(panel.open).toBe(true);

    fireEvent.submit(screen.getByRole("search"));

    expect(panel.open).toBe(false);
  });
});

describe("readFieldValues / buildQuery (tags)", () => {
  const TAGS: CaseFileTagView[] = [
    { id: 1, label: "Urgent", color: "red" },
    { id: 2, label: "Priorité", color: "blue" },
  ];
  const tagFacetFields: FacetField[] = [{ key: "mc", label: "Mots-clés" }];

  it("mappe les tokens mc vers les tags du catalogue", () => {
    const values = readFieldValues("mc:urgent mc:inconnu", tagFacetFields, ["mc"], TAGS);
    expect(values.tags).toEqual([TAGS[0]]);
  });

  it("sérialise chaque tag sélectionné en token mc", () => {
    expect(
      buildQuery(
        { freeText: "", facets: { mc: "" }, tags: [TAGS[0], TAGS[1]] },
        tagFacetFields,
        true,
      ),
    ).toBe("mc:Urgent mc:Priorité");
  });
});

describe("resolveFacetFieldValue", () => {
  const [requerant, statut] = FACET_FIELDS;

  it("laisse inchangée la valeur d'un champ texte", () => {
    expect(resolveFacetFieldValue(requerant, "Préfet")).toBe("Préfet");
  });

  it("retourne une chaîne vide quand aucune option ne correspond", () => {
    expect(resolveFacetFieldValue(statut, "inconnu")).toBe("");
  });
});
