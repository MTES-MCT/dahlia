import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { fetchCaseFilesTableData, fetchUsedStatusLabels } from "@/app/lib/data/case-files";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { SortableColumnHeader } from "@/app/ui/sortable-column-header";
import { CaseFilesSearchBar } from "@/app/ui/case-files-search-bar";
import { CaseFilesSearchByStatus } from "@/app/ui/case-files-search-by-status";
import Link from "next/link";
import clsx from "clsx";

const NUMBER_OF_CASE_FILES = 10;

type Props = {
  searchParams: Promise<{ page?: string, sortBy : string, sortOrder : string, q?: string, statut?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { page: pageParam, sortBy: sortByParam, sortOrder: sortOrderParam, q: qParam, statut: statutParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', NUMBER_OF_CASE_FILES) || 1);
  const currentSortBy = sortByParam ?? null;
  const currentSortOrder = sortOrderParam ?? 'descending';
  const currentQuery = qParam?.trim() ? qParam.trim() : null;
  const currentStatut = statutParam?.trim() ? statutParam.trim() : null;

  const [{ rows, totalPages, totalCount }, statusOptions] = await Promise.all([
    fetchCaseFilesTableData(currentPage, NUMBER_OF_CASE_FILES, currentSortBy, currentSortOrder, currentQuery, currentStatut),
    fetchUsedStatusLabels(),
  ]);

  return (
    <>
      <h1 className={fr.cx('fr-mt-3w')}>Tableau de bord</h1>

      <div className={clsx('flex', 'flex-row', 'gap-2', 'items-end')}>
        <CaseFilesSearchByStatus options={statusOptions} />
        <CaseFilesSearchBar className={clsx("flex-1", 'fr-mb-3w')} />
      </div>

      <Table
        caption={`${totalCount} dossier${totalCount > 1 ? 's' : ''}`}
        data={rows.map(([caseFileNumber, ...rest]) => [
          <Link key={caseFileNumber} href={`/case_files/${encodeURIComponent(caseFileNumber)}`}>
            {caseFileNumber}
          </Link>,
          ...rest,
        ])}
        fixed
        headers={[
          <SortableColumnHeader key="caseFileNumber" label="Dossier" sortKey="caseFileNumber" />,
          <SortableColumnHeader key="mainClaimant" label="Requérant" sortKey="mainClaimant" />,
          <SortableColumnHeader key="mainDefender" label="Défendeur" sortKey="mainDefender" />,
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
          if (currentQuery) params.set('q', currentQuery);
          if (currentStatut) params.set('statut', currentStatut);
          return { href: `/case_files?${params}`, scroll: false };
        }}
        showFirstLast
      />
    </>
  );
}
