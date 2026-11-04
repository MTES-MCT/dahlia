"use client";

import clsx from "clsx";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DASHBOARD_TABLE_PARAMS,
  STATUS_FACET_FIELD,
  getFacetValue,
  setFacet,
} from "@/app/lib/case-file-search";
import {
  STATUS_GROUP_LABELS,
  STATUS_GROUPS,
  resolveStatusGroup,
  statusLabelBelongsToGroup,
  type StatusGroup,
} from "@/app/lib/dashboard-filter";

type Props = {
  currentGroup: StatusGroup;
  counts: Record<StatusGroup, number>;
  children: React.ReactNode;
  className?: string;
};

// DSFR tabs switching the dashboard between « En cours », « Terminés » and
// « Tous les dossiers », each with its case-file counter. Changing tab navigates
// right away, keeps the search and sort, resets pagination and drops a
// `statut:` facet that does not belong to the new group (it would otherwise
// always yield an empty table). The selected panel renders `children`.
export function CaseFilesStatusGroupTabs({ currentGroup, counts, children, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabChange(tabId: string) {
    const group = resolveStatusGroup(tabId);
    if (group === currentGroup) return;

    const params = DASHBOARD_TABLE_PARAMS;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(params.page);
    nextParams.set("groupe", group);

    const query = nextParams.get(params.query) ?? "";
    const statut = getFacetValue(query, STATUS_FACET_FIELD.key);
    if (statut && !statusLabelBelongsToGroup(statut, group)) {
      const nextQuery = setFacet(query, STATUS_FACET_FIELD.key, "");
      if (nextQuery) {
        nextParams.set(params.query, nextQuery);
      } else {
        nextParams.delete(params.query);
      }
    }

    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      label="Catégories de dossiers"
      selectedTabId={currentGroup}
      onTabChange={handleTabChange}
      className={className}
      tabs={STATUS_GROUPS.map((group) => ({
        tabId: group,
        label: (
          <>
            {STATUS_GROUP_LABELS[group]}
            <span
              className={clsx(
                "ml-2 inline-block min-w-6 rounded-full px-1.5 text-center text-xs leading-5 font-bold",
                "bg-(--background-contrast-grey) text-(--text-mention-grey)",
                "group-aria-selected:bg-(--background-action-low-blue-france) group-aria-selected:text-(--text-action-high-blue-france)",
              )}
            >
              {counts[group]}
            </span>
          </>
        ),
      }))}
      classes={{ tab: "group" }}
    >
      {children}
    </Tabs>
  );
}
