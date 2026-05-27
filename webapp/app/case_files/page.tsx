import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { fetchCaseFilesTableData } from "@/app/lib/data/case-files";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { SortableColumnHeader } from "@/app/ui/sortable-column-header";

const NUMBER_OF_CASE_FILES = 10;

type Props = {
  searchParams: Promise<{ page?: string, sortBy : string, sortOrder : string }>;
};

export default async function Page({ searchParams }: Props) {
  const { page: pageParam, sortBy: sortByParam, sortOrder: sortOrderParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', NUMBER_OF_CASE_FILES) || 1);
  const currentSortBy = sortByParam ?? null;
  const currentSortOrder = sortOrderParam ?? 'descending';

  const { rows, totalPages, totalCount } = await fetchCaseFilesTableData(currentPage, NUMBER_OF_CASE_FILES, currentSortBy, currentSortOrder);

  return (
    <>
      <h1 className={fr.cx('fr-mt-3w')}>Tableau de bord</h1>

      <Table
        caption={`${totalCount} dossier${totalCount > 1 ? 's' : ''}`}
        data={rows}
        fixed
        headers={[
          <SortableColumnHeader key="caseFileNumber" label="Dossier" sortKey="caseFileNumber" />,
          'Requérant',
          'Défendeur',
          'Urgence',
          'État'
        ]}
      />
      <Pagination
        count={totalPages}
        defaultPage={currentPage}
        getPageLinkProps={(pageNumber: number) => {
          const params = new URLSearchParams({ page: String(pageNumber) });
          if (currentSortBy) params.set('sortBy', currentSortBy);
          if (currentSortOrder) params.set('sortOrder', currentSortOrder);
          return { href: `/case_files?${params}`, scroll: false };
        }}
        showFirstLast
      />
    </>
  );
}
