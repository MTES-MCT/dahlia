"use client";

import {
  SegmentedControl,
  type SegmentedControlProps,
} from "@codegouvfr/react-dsfr/SegmentedControl";
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
  statusLabelBelongsToGroup,
  type StatusGroup,
} from "@/app/lib/dashboard-filter";

type Props = {
  currentGroup: StatusGroup;
};

// DSFR segmented control switching the dashboard between « En cours »,
// « Terminé » and « Tous ». Changing group navigates right away, keeps the
// search and sort, resets pagination and drops a `statut:` facet that does not
// belong to the new group (it would otherwise always yield an empty table).
export function CaseFilesStatusGroupToggle({ currentGroup }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(group: StatusGroup) {
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

  const segment = (group: StatusGroup): SegmentedControlProps.SegmentWithoutIcon => ({
    label: STATUS_GROUP_LABELS[group],
    nativeInputProps: {
      value: group,
      // Uncontrolled so the click is reflected immediately while navigating;
      // the page remounts the toggle (key) once the new group is rendered.
      defaultChecked: group === currentGroup,
      onChange: () => handleChange(group),
    },
  });
  const [enCours, termine, tous] = STATUS_GROUPS;

  return (
    // The legend is visually hidden but kept for screen readers (RGAA).
    <SegmentedControl
      legend="Groupe de statuts des dossiers"
      hideLegend
      name="groupe"
      segments={[segment(enCours), segment(termine), segment(tous)]}
    />
  );
}
