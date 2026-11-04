"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  FACET_KEYS,
  normalizeForSearch,
  parseSearchQuery,
  serializeSearch,
  type DossierFacetKey,
} from "@/app/lib/case-file-search";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { resolveFacetFieldValue, type FacetField } from "@/app/ui/button/column-filter-button";
import { SavedSearchLabelRow } from "@/app/ui/form/saved-searches";
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
const FACET_INPUT_CLASSES: Partial<Record<string, string>> = {
  dossier: "max-w-60",
} satisfies Partial<Record<DossierFacetKey, string>>;

type FieldValues = {
  freeText: string;
  facets: Record<string, string>;
  // Tags selected in the tag combobox, in selection order.
  tags: CaseFileTagView[];
};

// Split a raw search query into the field values (free text + one value per
// facet field, select values mapped to their option). With a tag
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

// Rebuild the raw search query from the field values. Each selected
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

// One removable chip per active advanced filter: `facetKey` names the facet to
// clear, `tagId` the single tag to drop from the tag combobox selection.
type ActiveFilter = { id: string; label: string; facetKey: string; tagId?: number };

// Active advanced filters (facets only, free text excluded), in field order;
// each selected tag gets its own chip.
export function activeFilters(
  values: FieldValues,
  facetFields: readonly FacetField[],
  hasTagCombobox: boolean,
): ActiveFilter[] {
  return facetFields.flatMap((field): ActiveFilter[] => {
    if (hasTagCombobox && field.key === TAG_FACET_KEY) {
      return values.tags.map((tag) => ({
        id: `${field.key}-${tag.id}`,
        label: `Mot-clé : ${tag.label}`,
        facetKey: field.key,
        tagId: tag.id,
      }));
    }
    const value = (values.facets[field.key] ?? "").trim();
    return value
      ? [{ id: field.key, label: `${field.label} : ${value}`, facetKey: field.key }]
      : [];
  });
}

// Main free-text search field + « Filtres avancés » expandable panel of facet
// fields. Both are combined into one raw query submitted through a hidden
// field (`name`); the visible fields have no `name`, so pressing Enter anywhere
// runs the search with the combined query. Active facets are listed under the
// main field as dismissible tags: removing one re-runs the search right away.
// The panel closes when the form is submitted.
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
  const hasTagCombobox = tagField !== undefined;
  const otherFields = facetFields.filter((field) => field !== tagField);
  const [values, setValues] = useState(() =>
    readFieldValues(initialQuery, facetFields, facetKeys, availableTags),
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const close = () => setOpen(false);
    form.addEventListener("submit", close);
    return () => form.removeEventListener("submit", close);
  }, []);

  const filters = activeFilters(values, facetFields, hasTagCombobox);
  const activeFilterCount = filters.length;

  function setFacet(key: string, value: string) {
    setValues({ ...values, facets: { ...values.facets, [key]: value } });
  }

  // Apply the new values synchronously so the hidden query field is up to date,
  // then run the search.
  function submitWith(nextValues: FieldValues) {
    flushSync(() => setValues(nextValues));
    rootRef.current?.closest("form")?.requestSubmit();
  }

  function removeFilter(filter: ActiveFilter) {
    submitWith(
      filter.tagId !== undefined
        ? { ...values, tags: values.tags.filter((tag) => tag.id !== filter.tagId) }
        : { ...values, facets: { ...values.facets, [filter.facetKey]: "" } },
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={buildQuery(values, facetFields, hasTagCombobox)} />
      {/* Mobile: « Filtres avancés » above saved-search controls (`flex-col-reverse`).
          Desktop: saved search on the left, filter toggle on the right. The facet
          panel opens below the main field so the toggle and input stay on top. */}
      <div
        className={clsx(
          "flex flex-col-reverse md:flex-row md:items-center md:justify-between",
          "gap-2",
          fr.cx("fr-mb-1w"),
        )}
      >
        <SavedSearchLabelRow className="min-w-0 md:flex-1" />
        <details
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
          className={clsx(fr.cx("fr-mb-0"), "w-full shrink-0 self-end md:w-auto")}
        >
          <summary
            className={clsx(
              fr.cx(
                "fr-link",
                activeFilterCount > 0 ? "fr-icon-filter-fill" : "fr-icon-filter-line",
                "fr-link--icon-left",
              ),
              "cursor-pointer",
              "list-none",
              "[&::-webkit-details-marker]:hidden",
              "md:ml-auto",
            )}
          >
            {open ? "Masquer les filtres avancés" : "Filtres avancés"}
            {activeFilterCount > 0 && (
              <Badge as="span" small noIcon severity="info" className={fr.cx("fr-ml-1w")}>
                {activeFilterCount}
                <span className={fr.cx("fr-sr-only")}>
                  {activeFilterCount > 1 ? " filtres actifs" : " filtre actif"}
                </span>
              </Badge>
            )}
          </summary>
        </details>
      </div>

      <Input
        label={<span className={fr.cx("fr-sr-only")}>Rechercher</span>}
        className={fr.cx("fr-mb-1w")}
        nativeInputProps={{
          id: `${name}-search`,
          type: "search",
          value: values.freeText,
          placeholder,
          onChange: (event) => setValues({ ...values, freeText: event.target.value }),
        }}
      />

      {open && (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-1w", "fr-mb-3w")}>
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
          {tagField && availableTags && (
            <div className={fr.cx("fr-col-12", "fr-col-md-12", "fr-col-lg-8")}>
              <TagCombobox
                label={tagField.label}
                availableTags={availableTags}
                selectedIds={values.tags.map((tag) => tag.id)}
                onChange={(ids) =>
                  setValues({
                    ...values,
                    tags: ids
                      .map((id) => availableTags.find((tag) => tag.id === id))
                      .filter((tag): tag is CaseFileTagView => tag !== undefined),
                  })
                }
                className="max-w-140"
              />
            </div>
          )}
        </div>
      )}

      {/* Hidden while the panel is open: its fields already show the filters. */}
      {!open && filters.length > 0 && (
        <div role="group" aria-label="Filtres actifs" className={fr.cx("fr-mb-3w")}>
          {/* Sized to the tags: DSFR gives each `li` a 2.75rem line-height
              (`flex` makes it fit its tag) and each tag a bottom margin
              (removed by `fr-mb-0`); the row gap replaces that margin when
              tags wrap. */}
          <ul className={clsx(fr.cx("fr-tags-group", "fr-mb-0"), "gap-y-2")}>
            {filters.map((filter) => (
              <li key={filter.id} className="flex">
                <Tag
                  small
                  dismissible
                  nativeButtonProps={{
                    type: "button",
                    "aria-label": `Retirer le filtre ${filter.label}`,
                    onClick: () => removeFilter(filter),
                  }}
                  className={fr.cx("fr-mb-0")}
                >
                  {filter.label}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
