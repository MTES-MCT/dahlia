import { describe, it, expect, afterEach } from "vitest";
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

function renderFields(initialQuery: string) {
  return render(
    <form role="search">
      <CaseFilesSearchFields
        initialQuery={initialQuery}
        facetFields={FACET_FIELDS}
        name="dahliaq"
      />
      <button type="submit">Rechercher</button>
    </form>,
  );
}

// Labels are matched on their start: DSFR renders the hint text inside <label>.
function field(label: string): HTMLInputElement | HTMLSelectElement {
  return screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement | HTMLSelectElement;
}

function mainField(): HTMLInputElement {
  return screen.getByLabelText("Rechercher") as HTMLInputElement;
}

function details(): HTMLDetailsElement {
  return screen.getByText("Filtres avancés").closest("details") as HTMLDetailsElement;
}

describe("CaseFilesSearchFields", () => {
  afterEach(() => {
    cleanup();
  });

  it("pré-remplit le champ principal et les filtres avancés avec la dernière recherche", () => {
    renderFields('dupont requerant:prefet statut:"Terminé"');

    expect(mainField().value).toBe('dupont requerant:prefet statut:"Terminé"');
    expect(field("Recherché dans toutes les colonnes").value).toBe("dupont");
    expect(field("Requérant").value).toBe("prefet");
    expect(field("Statut").value).toBe("Terminé");
    expect(field("Type de recours").value).toBe("");
  });

  it("sélectionne l'option correspondant à une valeur saisie sans accent ni casse", () => {
    renderFields("statut:termine recours:rep");

    expect(field("Statut").value).toBe("Terminé");
    expect(field("Type de recours").value).toBe("Recours en excès de pouvoir (REP)");
  });

  it("met à jour les filtres avancés quand on tape dans le champ principal", () => {
    renderFields("");

    fireEvent.change(mainField(), { target: { value: "durand requerant:prefet" } });

    expect(field("Recherché dans toutes les colonnes").value).toBe("durand");
    expect(field("Requérant").value).toBe("prefet");
  });

  it("met à jour le champ principal quand on modifie un filtre avancé", () => {
    renderFields("dupont");

    fireEvent.change(field("Statut"), { target: { value: "Terminé" } });
    fireEvent.change(field("Requérant"), { target: { value: "le prefet" } });

    expect(mainField().value).toBe('dupont requerant:"le prefet" statut:Terminé');
  });

  it("seul le champ principal est soumis", () => {
    renderFields("dupont statut:Terminé");

    const form = screen.getByRole("search") as HTMLFormElement;
    expect([...new FormData(form).keys()]).toEqual(["dahliaq"]);
  });

  it("affiche le nombre de filtres actifs sur le lien « Filtres avancés »", () => {
    renderFields("dupont requerant:prefet statut:Terminé");

    expect(screen.getByText("Filtres avancés").textContent).toContain("3");
    expect(screen.getByText("filtres actifs", { exact: false })).toBeTruthy();
  });

  it("incrémente le compteur quand on ajoute du texte libre dans les filtres avancés", () => {
    renderFields("requerant:prefet statut:Terminé");

    expect(screen.getByText("Filtres avancés").textContent).toContain("2");

    fireEvent.change(field("Recherché dans toutes les colonnes"), { target: { value: "dupont" } });

    expect(screen.getByText("Filtres avancés").textContent).toContain("3");
  });

  it("affiche un compteur pour une recherche en texte libre seul", () => {
    renderFields("dupont");

    expect(screen.getByText("Filtres avancés").textContent).toContain("1");
    expect(screen.getByText("filtre actif", { exact: false })).toBeTruthy();
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
      buildQuery({ freeText: "", facets: { mc: "" }, tags: [TAGS[0], TAGS[1]] }, tagFacetFields, true),
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
