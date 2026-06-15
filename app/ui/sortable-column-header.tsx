"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";

type SortOrder = "ascending" | "descending";

type Props = {
  label: string;
  sortKey: string;
  // When set, this column is the default sort applied when no `sortBy` is in the
  // URL: it appears active with this order even though no param is present.
  defaultOrder?: SortOrder;
};

export function SortableColumnHeader({ label, sortKey, defaultOrder }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSortBy = searchParams.get("sortBy");
  const currentSortOrder = searchParams.get("sortOrder");

  // No sort in the URL → fall back to this column's default sort, if any.
  const isDefaultActive = currentSortBy === null && defaultOrder !== undefined;
  const isActive = currentSortBy === sortKey || isDefaultActive;
  const effectiveOrder: SortOrder = isDefaultActive
    ? defaultOrder
    : ((currentSortOrder ?? "ascending") as SortOrder);
  const ariaSortValue = isActive ? effectiveOrder : "none";

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", sortKey);
    params.set(
      "sortOrder",
      isActive && effectiveOrder === "ascending" ? "descending" : "ascending",
    );
    params.delete("page");
    router.push(`?${params.toString()}`);
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
          Hors-spec ARIA sur un <button>, mais nécessaire au rendu visuel. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        className={fr.cx("fr-btn--sort")}
        aria-sort={ariaSortValue}
        aria-label={`Trier par ${label}${isActive ? (ariaSortValue === "ascending" ? ", ordre croissant" : ", ordre décroissant") : ""}`}
        onClick={handleClick}
        type="button"
      >
        {label}
      </button>
    </span>
  );
}
