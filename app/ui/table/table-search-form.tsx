"use client";

import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent } from "react";
import { type TableParamNames } from "@/app/lib/case-file-search";
import { type TableSearchHiddenParam } from "@/app/lib/table-search-context";
import { HiddenField } from "@/app/ui/hidden-field";
import { TableSearchBar } from "@/app/ui/table/table-search-bar";

export type TableSearchFormProps = {
  action: string;
  params: TableParamNames;
  label: string;
  placeholder?: string;
  currentQuery: string;
  hiddenParams: TableSearchHiddenParam[];
  resetHref: string;
  // Replaces the default search bar (e.g. dashboard status filter + text field row).
  searchSlot?: React.ReactNode;
  className?: string;
};

// GET search form for a table. Submitting navigates with the visible query under
// `params.query`, preserves `hiddenParams`, and omits `params.page` so pagination
// resets to page 1. Navigation uses `scroll: false` so the viewport stays put.
export function TableSearchForm({
  action,
  params,
  label,
  placeholder,
  currentQuery,
  hiddenParams,
  resetHref,
  searchSlot,
  className,
}: TableSearchFormProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextParams = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        nextParams.append(key, value);
      }
    }
    const queryString = nextParams.toString();
    const href = queryString ? `${action}?${queryString}` : action;
    router.push(href, { scroll: false });
    router.refresh();
  }

  return (
    <form
      role="search"
      method="get"
      action={action}
      onSubmit={handleSubmit}
      className={clsx("fr-mb-2w", className)}
    >
      {hiddenParams.map(({ name, value }, index) => (
        <HiddenField key={`${name}-${index}`} name={name} value={value} />
      ))}

      {searchSlot ?? (
        <TableSearchBar
          key={currentQuery}
          name={params.query}
          label={label}
          defaultValue={currentQuery}
          placeholder={placeholder}
        />
      )}

      <div className={clsx("flex", "flex-row", "gap-4", "items-center")}>
        <Button type="submit" title="Rechercher">
          Rechercher
        </Button>
        <Link
          href={resetHref}
          scroll={false}
          className={fr.cx("fr-link", "fr-icon-refresh-line", "fr-link--icon-left")}
        >
          Ré-initialiser la recherche
        </Link>
      </div>
    </form>
  );
}
