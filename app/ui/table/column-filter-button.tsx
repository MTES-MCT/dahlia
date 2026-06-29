"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  type TableParamNames,
  DASHBOARD_TABLE_PARAMS,
  getFacetValue,
  setFacet,
} from "@/app/lib/case-file-search";

type Props = {
  // Facet key this column maps to (e.g. "requerant").
  facetKey: string;
  // Column label, used to build accessible names.
  label: string;
  // URL param names backing the search/pagination state. Defaults to the
  // dashboard's; detail tables pass a prefixed set.
  params?: TableParamNames;
  // Facet keys recognized in this table's search grammar. Defaults to the
  // dashboard's FACET_KEYS (via the grammar helpers' own default).
  facetKeys?: readonly string[];
};

// Per-column filter: an icon button that opens a small popover where the user
// types a value. Submitting injects/replaces the `facetKey` facet in the shared
// search field and re-runs the search (client navigation). The sort, status and
// existing search context are preserved; pagination resets to page 1.
export function ColumnFilterButton({
  facetKey,
  label,
  params = DASHBOARD_TABLE_PARAMS,
  facetKeys,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get(params.query) ?? "";
  const currentValue = getFacetValue(currentQuery, facetKey, facetKeys);
  const isActive = currentValue !== "";

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue);
  const containerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverId = useId();

  // Open the popover, seeding the input from the URL (done here rather than in
  // an effect so typing is never clobbered by a re-render).
  function toggle() {
    if (!open) setValue(currentValue);
    setOpen((wasOpen) => !wasOpen);
  }

  // Focus the input when the popover opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
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

  function submit() {
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextQuery = setFacet(currentQuery, facetKey, value, facetKeys);
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
          "aria-label": `Filtrer par ${label}${isActive ? ` (filtre actif : ${currentValue})` : ""}`,
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
            right: 0,
            zIndex: 10,
            marginTop: "0.25rem",
            padding: "0.5rem",
            minWidth: "16rem",
            backgroundColor: "var(--background-overlap-grey)",
            boxShadow: "var(--overlap-shadow, 0 2px 6px rgba(0,0,0,0.16))",
            borderRadius: "0.25rem",
          }}
        >
          <Input
            label={`Valeur à rechercher dans la colonne ${label}`}
            hideLabel
            nativeInputProps={{
              ref: inputRef,
              id: `${popoverId}-input`,
              type: "search",
              value,
              placeholder: label,
              onChange: (event) => setValue(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              },
            }}
            action={
              <Button type="button" size="small" title="Appliquer le filtre" onClick={submit}>
                Filtrer
              </Button>
            }
          />
        </span>
      )}
    </span>
  );
}
