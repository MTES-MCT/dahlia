"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { type FacetKey, getFacetValue, setFacet } from "@/app/lib/case-file-search";

type Props = {
  // Facet key this column maps to (e.g. "requerant").
  facetKey: FacetKey;
  // Column label, used to build accessible names.
  label: string;
};

// Per-column filter: an icon button that opens a small popover where the user
// types a value. Submitting injects/replaces the `facetKey` facet in the shared
// `dahliaq` search field and re-runs the search (client navigation). The sort,
// status and existing search context are preserved; pagination resets to page 1.
export function ColumnFilterButton({ facetKey, label }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("dahliaq") ?? "";
  const currentValue = getFacetValue(currentQuery, facetKey);
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
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = setFacet(currentQuery, facetKey, value);
    if (nextQuery) {
      params.set("dahliaq", nextQuery);
    } else {
      params.delete("dahliaq");
    }
    params.delete("page");
    setOpen(false);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : "?", { scroll: false });
  }

  return (
    <span ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className={fr.cx(
          "fr-btn",
          isActive ? "fr-icon-filter-fill" : "fr-icon-filter-line",
          "fr-btn--tertiary-no-outline",
          "fr-btn--sm",
        )}
        aria-label={`Filtrer par ${label}${isActive ? ` (filtre actif : ${currentValue})` : ""}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={toggle}
        title={`Filtrer par ${label}`}
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
          <span className={fr.cx("fr-search-bar")}>
            <label className={fr.cx("fr-label", "fr-sr-only")} htmlFor={`${popoverId}-input`}>
              {`Valeur à rechercher dans la colonne ${label}`}
            </label>
            <input
              ref={inputRef}
              id={`${popoverId}-input`}
              className={fr.cx("fr-input")}
              type="search"
              value={value}
              placeholder={label}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              className={fr.cx("fr-btn", "fr-btn--sm")}
              title="Appliquer le filtre"
              onClick={submit}
            >
              Filtrer
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
