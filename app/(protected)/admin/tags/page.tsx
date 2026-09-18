import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import type { Metadata } from "next";
import { fetchTagsTableData, type TagListRow } from "@/app/lib/data/tags";
import { buildTableSearchContext } from "@/app/lib/table-search-context";
import { TAGS_FACET_KEYS, TAGS_PARAMS } from "@/app/lib/tags-table";
import { TAG_COLOR_LABELS, isTagColor } from "@/app/lib/tag-colors";
import { CreateTagButton } from "@/app/ui/admin/create-tag-button";
import { TagRowActions, TagsActionsProvider } from "@/app/ui/admin/tags-actions";
import { TagBadge } from "@/app/ui/case-file/tag-badge";
import { DataTable, type DataTableColumn } from "@/app/ui/table/data-table";

export const metadata: Metadata = {
  title: "Tags - Administration",
};

function tagsColumns(): DataTableColumn<TagListRow>[] {
  return [
    {
      key: "label",
      label: "Libellé",
      sortable: true,
      defaultOrder: "ascending",
      facetFields: [{ key: "nom", label: "Libellé" }],
      render: (tag) => <TagBadge tag={tag} />,
    },
    {
      key: "color",
      label: "Couleur",
      sortable: true,
      render: (tag) => (isTagColor(tag.color) ? TAG_COLOR_LABELS[tag.color] : tag.color),
    },
    {
      key: "caseFileCount",
      label: "Dossiers",
      sortable: true,
      width: "8rem",
      render: (tag) => tag.caseFileCount,
    },
    {
      key: "actions",
      label: "Actions",
      width: "6rem",
      render: (tag) => <TagRowActions tag={tag} />,
    },
  ];
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTagsPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const table = await fetchTagsTableData(resolvedSearchParams);
  const search = buildTableSearchContext(resolvedSearchParams, TAGS_PARAMS, "/admin/tags");

  return (
    <TagsActionsProvider>
      <div
        className={clsx(
          fr.cx("fr-mb-2w"),
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <h1 className={fr.cx("fr-h2", "fr-mb-0")}>Tags</h1>
        <CreateTagButton />
      </div>

      <DataTable
        columns={tagsColumns()}
        rows={table.rows}
        totalCount={table.totalCount}
        totalPages={table.totalPages}
        currentPage={table.currentPage}
        pageSize={table.pageSize}
        params={TAGS_PARAMS}
        tableId="tags"
        facetKeys={TAGS_FACET_KEYS}
        caption={(count) => `${count} tag${count > 1 ? "s" : ""}`}
        search={{
          ...search,
          label: "Rechercher un tag",
          placeholder: "Libellé",
        }}
      />
    </TagsActionsProvider>
  );
}
