"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { type TableParamNames, DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";

type SortOrder = "ascending" | "descending";

type Props = {
  label: string;
  sortKey: string;
  // When set, this column is the default sort applied when no `sortBy` is in the
  // URL: it appears active with this order even though no param is present.
  defaultOrder?: SortOrder;
  // URL param names backing the sort state. Defaults to the dashboard's
  // (`sortBy`/`sortOrder`/`page`); detail tables pass a prefixed set.
  params?: TableParamNames;
};

export function SortableColumnHeader({
  label,
  sortKey,
  defaultOrder,
  params = DASHBOARD_TABLE_PARAMS,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSortBy = searchParams.get(params.sortBy);
  const currentSortOrder = searchParams.get(params.sortOrder);

  // No sort in the URL → fall back to this column's default sort, if any.
  const isDefaultActive = currentSortBy === null && defaultOrder !== undefined;
  const isActive = currentSortBy === sortKey || isDefaultActive;
  const effectiveOrder: SortOrder = isDefaultActive
    ? defaultOrder
    : ((currentSortOrder ?? "ascending") as SortOrder);
  const ariaSortValue = isActive ? effectiveOrder : "none";

  function handleClick() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(params.sortBy, sortKey);
    nextParams.set(
      params.sortOrder,
      isActive && effectiveOrder === "ascending" ? "descending" : "ascending",
    );
    nextParams.delete(params.page);
    router.push(`?${nextParams.toString()}`);
  }

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      {label}
      {/* aria-sort est requis par le CSS DSFR (.fr-btn--sort[aria-sort=...]) pour piloter l'icône de tri.
          Hors-spec ARIA sur un <button>, mais nécessaire au rendu visuel ; passé via
          nativeButtonProps puisque le composant Button DSFR n'expose pas aria-sort. */}
      <Button
        className={fr.cx("fr-btn--sort")}
        type="button"
        onClick={handleClick}
        nativeButtonProps={{
          "aria-sort": ariaSortValue,
          "aria-label": `Trier par ${label}${isActive ? (ariaSortValue === "ascending" ? ", ordre croissant" : ", ordre décroissant") : ""}`,
        }}
      >
        {label}
      </Button>
    </span>
  );
}
