"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import clsx from "clsx";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { HiddenField } from "@/app/ui/hidden-field";
import { TableSearchBar } from "@/app/ui/table-search-bar";

type Props = {
  // URL param names backing this table's state (search + pagination reset).
  params: TableParamNames;
  // Accessible label / visible field label.
  label: string;
  placeholder?: string;
  className?: string;
};

// Client text-search form for an in-memory table sharing the page URL with
// other tables. It is a plain native GET form (like the dashboard): submitting
// navigates to the same path with the search input under `params.query`. The
// other tables' params and the selected tab are carried over as hidden inputs,
// and omitting `params.page` resets this table to page 1. The visible field is
// the `TableSearchBar`; the search string uses the same grammar as the dashboard
// (free text + `key:value` facets), so a per-column filter and the search box
// stay in sync.
export function TableSearch({ params, label, placeholder, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get(params.query) ?? "";

  // Carry over every current param except this table's search (held by the
  // visible input) and page (dropped to reset to page 1 on submit).
  const hiddenParams = Array.from(searchParams.entries()).filter(
    ([key]) => key !== params.query && key !== params.page,
  );

  // Reset navigates by removing this table's search/page params. The input is
  // uncontrolled and remounted via its `key`, so it clears itself on the
  // resulting navigation (no local state to wipe), like the dashboard reset.
  function reset() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(params.query);
    nextParams.delete(params.page);
    const queryString = nextParams.toString();
    router.push(queryString ? `?${queryString}` : "?", { scroll: false });
  }

  return (
    <form role="search" method="get" action={pathname} className={clsx("fr-mb-2w", className)}>
      {hiddenParams.map(([key, val], index) => (
        <HiddenField key={`${key}-${index}`} name={key} value={val} />
      ))}
      <TableSearchBar
        // Remount on query change so the uncontrolled field re-seeds from the
        // URL after a navigation (submit, column filter button, reset).
        key={currentQuery}
        name={params.query}
        label={label}
        defaultValue={currentQuery}
        placeholder={placeholder}
      />
      <Button type="submit" title="Rechercher">
        Rechercher
      </Button>
      <Button
        type="button"
        priority="tertiary no outline"
        iconId="fr-icon-refresh-line"
        className={fr.cx("fr-mt-1w")}
        onClick={reset}
      >
        Ré-initialiser la recherche
      </Button>
    </form>
  );
}
