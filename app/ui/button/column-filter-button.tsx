"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  type TableParamNames,
  DASHBOARD_TABLE_PARAMS,
  getFacetValue,
  setFacetValues,
} from "@/app/lib/case-file-search";
import { fr } from "@codegouvfr/react-dsfr";

export type FacetField = {
  key: string;
  label: string;
};

type Props = {
  // Column label, used to build accessible names.
  label: string;
  facetFields: readonly FacetField[];
  // URL param names backing the search/pagination state. Defaults to the
  // dashboard's; detail tables pass a prefixed set.
  params?: TableParamNames;
  // Facet keys recognized in this table's search grammar. Defaults to the
  // dashboard's FACET_KEYS (via the grammar helpers' own default).
  facetKeys?: readonly string[];
};

// Matches the popover `minWidth` so we can pick alignment before paint.
const POPOVER_MIN_WIDTH_REM = 16;

function buildActiveFilterSummary(
  currentQuery: string,
  fields: readonly FacetField[],
  facetKeys: readonly string[] | undefined,
): string {
  return fields
    .map((field) => {
      const value = getFacetValue(currentQuery, field.key, facetKeys);
      return value ? `${field.label} : ${value}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

function buildFieldValues(
  currentQuery: string,
  fields: readonly FacetField[],
  facetKeys: readonly string[] | undefined,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [field.key, getFacetValue(currentQuery, field.key, facetKeys)]),
  );
}

// Per-column filter: an icon button that opens a small popover where the user
// types a value. Submitting injects/replaces facet(s) in the shared search
// field and re-runs the search (client navigation). The sort, status and
// existing search context are preserved; pagination resets to page 1.
export function ColumnFilterButton({
  label,
  facetFields: fields,
  params = DASHBOARD_TABLE_PARAMS,
  facetKeys,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get(params.query) ?? "";
  const activeSummary = buildActiveFilterSummary(currentQuery, fields, facetKeys);
  const isActive = activeSummary !== "";

  const [open, setOpen] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    buildFieldValues(currentQuery, fields, facetKeys),
  );
  const [alignPopoverStart, setAlignPopoverStart] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const popoverId = useId();

  // Open the popover, seeding inputs from the URL (done here rather than in
  // an effect so typing is never clobbered by a re-render).
  function toggle() {
    if (!open) {
      setFieldValues(buildFieldValues(currentQuery, fields, facetKeys));
    }
    setOpen((wasOpen) => !wasOpen);
  }

  // Anchor the popover to the left when right-alignment would overflow the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const popoverMinWidth = POPOVER_MIN_WIDTH_REM * rootFontSize;
    const { right } = container.getBoundingClientRect();
    setAlignPopoverStart(right - popoverMinWidth < 0);
  }, [open, fields.length]);

  // Focus the first input when the popover opens.
  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
  }, [open]);

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pushQuery(nextQuery: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      nextParams.set(params.query, nextQuery);
    } else {
      nextParams.delete(params.query);
    }
    nextParams.delete(params.page);
    setOpen(false);
    const queryString = nextParams.toString();
    router.push(queryString ? `?${queryString}` : "?", { scroll: false });
  }

  function submit() {
    pushQuery(setFacetValues(currentQuery, fieldValues, facetKeys));
  }

  function handleFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  }

  return (
    <span ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <Button
        type="button"
        priority="tertiary no outline"
        size="small"
        iconId={isActive ? "fr-icon-filter-fill" : "fr-icon-filter-line"}
        title={`Filtrer par ${label}`}
        onClick={toggle}
        nativeButtonProps={{
          "aria-label": `Filtrer par ${label}${isActive ? ` (filtre actif : ${activeSummary})` : ""}`,
          "aria-expanded": open,
          "aria-controls": popoverId,
        }}
      />
      {open && (
        <span
          id={popoverId}
          role="dialog"
          aria-label={`Filtrer par ${label}`}
          style={{
            position: "absolute",
            top: "100%",
            ...(alignPopoverStart ? { left: 0 } : { right: 0 }),
            zIndex: 10,
            marginTop: "0.25rem",
            padding: "0.5rem",
            minWidth: `${POPOVER_MIN_WIDTH_REM}rem`,
            backgroundColor: "var(--background-overlap-grey)",
            boxShadow: "var(--overlap-shadow, 0 2px 6px rgba(0,0,0,0.16))",
            borderRadius: "0.25rem",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {fields.map((field, index) => (
              <Input
                key={field.key}
                label={field.label}
                className={fr.cx("fr-mb-0")}
                hideLabel
                nativeInputProps={{
                  ref: index === 0 ? firstFieldRef : undefined,
                  id: `${popoverId}-${field.key}`,
                  type: "search",
                  value: fieldValues[field.key] ?? "",
                  placeholder: field.label,
                  onChange: (event) =>
                    setFieldValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    })),
                  onKeyDown: handleFieldKeyDown,
                }}
              />
            ))}
            <Button type="button" size="small" title="Appliquer le filtre" onClick={submit}>
              Filtrer
            </Button>
          </span>
        </span>
      )}
    </span>
  );
}
