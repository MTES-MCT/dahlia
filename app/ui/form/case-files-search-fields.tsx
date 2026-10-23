"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  FACET_KEYS,
  normalizeForSearch,
  parseSearchQuery,
  serializeSearch,
  type DossierFacetKey,
} from "@/app/lib/case-file-search";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { resolveFacetFieldValue, type FacetField } from "@/app/ui/button/column-filter-button";
import { TagCombobox } from "@/app/ui/form/tag-picker";

// Facet picked with the tag combobox (one `mc:<label>` token per selected tag)
// when the tag catalogue is provided, instead of a free-text input.
const TAG_FACET_KEY: DossierFacetKey = "mc";

// Fields are capped in width so they never span their whole grid column
// (accessibility rule, cf. AGENTS.md).
const FIELD_CLASSES = clsx(fr.cx("fr-mb-0"), "max-w-md");

// Selects shrink to their widest option. `!` is required: DSFR sets
// `.fr-select { width: 100% }` outside any cascade layer, which beats Tailwind
// utilities otherwise.
const SELECT_CLASSES = clsx("w-auto!", "max-w-full");

// Text inputs are capped at 20rem by default, sized to the expected input
// otherwise; labels and hints keep the column width.
const TEXT_INPUT_CLASSES = "max-w-80";
const FREE_TEXT_INPUT_CLASSES = "max-w-100";
const FACET_INPUT_CLASSES: Partial<Record<string, string>> = {
  dossier: "max-w-60",
} satisfies Partial<Record<DossierFacetKey, string>>;

type FieldValues = {
  freeText: string;
  facets: Record<string, string>;
  // Tags selected in the tag combobox, in selection order.
  tags: CaseFileTagView[];
};

// Split a raw search query into the advanced filter values (free text + one
// value per facet field, select values mapped to their option). With a tag
// catalogue, every `mc:` value naming an existing tag becomes a selected tag;
// the others are dropped, like a select value matching no option.
export function readFieldValues(
  query: string,
  facetFields: readonly FacetField[],
  facetKeys: readonly string[] = FACET_KEYS,
  availableTags?: readonly CaseFileTagView[],
): FieldValues {
  const parsed = parseSearchQuery(query, facetKeys);
  const tags = availableTags
    ? parsed.facets
        .filter((facet) => facet.key === TAG_FACET_KEY)
        .map((facet) => {
          const normalized = normalizeForSearch(facet.value.trim());
          return availableTags.find((tag) => normalizeForSearch(tag.label) === normalized);
        })
        .filter((tag): tag is CaseFileTagView => tag !== undefined)
        .filter((tag, index, all) => all.indexOf(tag) === index)
    : [];
  return {
    freeText: parsed.freeText ?? "",
    facets: Object.fromEntries(
      facetFields.map((field) => [
        field.key,
        resolveFacetFieldValue(
          field,
          parsed.facets.find((facet) => facet.key === field.key)?.value ?? "",
        ),
      ]),
    ),
    tags,
  };
}

// Rebuild the raw search query from the advanced filter values. Each selected
// tag is its own `mc:` token, so a case file must carry all of them.
export function buildQuery(
  values: FieldValues,
  facetFields: readonly FacetField[],
  hasTagCombobox = false,
): string {
  return serializeSearch({
    freeText: values.freeText.trim() || null,
    facets: [
      ...facetFields
        .filter((field) => !(hasTagCombobox && field.key === TAG_FACET_KEY))
        .map((field) => ({ key: field.key, value: (values.facets[field.key] ?? "").trim() }))
        .filter((facet) => facet.value !== ""),
      ...(hasTagCombobox
        ? values.tags.map((tag) => ({ key: TAG_FACET_KEY, value: tag.label }))
        : []),
    ],
  });
}

type Props = {
  // Search query from the URL; the parent remounts this component (key) when it changes.
  initialQuery: string;
  // Every facet of the table (status options included), in display order.
  facetFields: readonly FacetField[];
  // Form param carrying the raw query (`dahliaq`).
  name: string;
  placeholder?: string;
  facetKeys?: readonly string[];
  // Tag catalogue: when set, the `mc` facet is picked with the tag combobox,
  // shown last.
  availableTags?: readonly CaseFileTagView[];
};

// Main search field + « Filtres avancés » expandable panel, both editing one
// raw query: typing in the main field updates the advanced fields and vice
// versa. Only the main field is submitted (advanced fields have no `name`),
// so pressing Enter anywhere runs the search with the synced query. The panel
// closes when the form is submitted.
export function CaseFilesSearchFields({
  initialQuery,
  facetFields,
  name,
  placeholder,
  facetKeys = FACET_KEYS,
  availableTags,
}: Props) {
  const tagField = availableTags
    ? facetFields.find((field) => field.key === TAG_FACET_KEY)
    : undefined;
  const otherFields = facetFields.filter((field) => field !== tagField);
  const [query, setQuery] = useState(initialQuery);
  const [values, setValues] = useState(() =>
    readFieldValues(initialQuery, facetFields, facetKeys, availableTags),
  );
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const form = detailsRef.current?.closest("form");
    if (!form) return;
    const close = () => setOpen(false);
    form.addEventListener("submit", close);
    return () => form.removeEventListener("submit", close);
  }, []);

  const activeFilterCount = parseSearchQuery(query, facetKeys).facets.length;

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setValues(readFieldValues(nextQuery, facetFields, facetKeys, availableTags));
  }

  // Advanced fields keep their raw (untrimmed) value locally so typing a space
  // is not swallowed; the main field receives the normalized query.
  function updateValues(nextValues: FieldValues) {
    setValues(nextValues);
    setQuery(buildQuery(nextValues, facetFields, tagField !== undefined));
  }

  function setFacet(key: string, value: string) {
    updateValues({ ...values, facets: { ...values.facets, [key]: value } });
  }

  return (
    <>
      <Input
        label="Rechercher"
        className={fr.cx("fr-mb-1w")}
        nativeInputProps={{
          id: `${name}-search`,
          name,
          type: "search",
          value: query,
          placeholder,
          onChange: (event) => handleQueryChange(event.target.value),
        }}
      />

      <details
        ref={detailsRef}
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className={fr.cx("fr-mb-3w")}
      >
        <summary
          className={clsx(
            fr.cx(
              "fr-link",
              activeFilterCount > 0 ? "fr-icon-filter-fill" : "fr-icon-filter-line",
              "fr-link--icon-left",
            ),
            "cursor-pointer",
          )}
        >
          Filtres avancés
          {activeFilterCount > 0 && (
            <Badge as="span" small noIcon severity="info" className={fr.cx("fr-ml-1w")}>
              {activeFilterCount}
              <span className={fr.cx("fr-sr-only")}>
                {activeFilterCount > 1 ? " filtres actifs" : " filtre actif"}
              </span>
            </Badge>
          )}
        </summary>

        {/* DSFR grid: 1 column below md, 2 from md, 3 from lg. */}
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-1w")}>
          <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}>
            <Input
              label="Recherché dans toutes les colonnes (Texte libre)"
              className={FIELD_CLASSES}
              classes={{ nativeInputOrTextArea: FREE_TEXT_INPUT_CLASSES }}
              nativeInputProps={{
                type: "search",
                value: values.freeText,
                onChange: (event) => updateValues({ ...values, freeText: event.target.value }),
              }}
            />
          </div>
          {otherFields.map((field) => (
            <div key={field.key} className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}>
              {field.options ? (
                <Select
                  label={field.label}
                  className={FIELD_CLASSES}
                  nativeSelectProps={{
                    className: SELECT_CLASSES,
                    value: values.facets[field.key] ?? "",
                    onChange: (event) => setFacet(field.key, event.target.value),
                  }}
                >
                  {/* Empty choice: no filter on this field. */}
                  <option value="" />
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  label={field.label}
                  className={FIELD_CLASSES}
                  classes={{
                    nativeInputOrTextArea: FACET_INPUT_CLASSES[field.key] ?? TEXT_INPUT_CLASSES,
                  }}
                  nativeInputProps={{
                    type: "search",
                    value: values.facets[field.key] ?? "",
                    onChange: (event) => setFacet(field.key, event.target.value),
                  }}
                />
              )}
            </div>
          ))}
        </div>
        {/* Outside the grid: the field and its selected badges get a wider row. */}
        {tagField && availableTags && (
          <TagCombobox
            label={tagField.label}
            availableTags={availableTags}
            selectedIds={values.tags.map((tag) => tag.id)}
            onChange={(ids) =>
              updateValues({
                ...values,
                tags: ids
                  .map((id) => availableTags.find((tag) => tag.id === id))
                  .filter((tag): tag is CaseFileTagView => tag !== undefined),
              })
            }
            className={clsx(fr.cx("fr-mt-3w"), "max-w-140")}
          />
        )}
      </details>
    </>
  );
}
