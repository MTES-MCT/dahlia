import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { fetchCaseFilesTableData } from "@/app/lib/data/case-files";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";

const NUMBER_OF_CASE_FILES = 10;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', NUMBER_OF_CASE_FILES) || 1);

  const { rows, totalPages } = await fetchCaseFilesTableData(currentPage, NUMBER_OF_CASE_FILES);

  return (
    <>
      <h1 className={fr.cx('fr-mt-3w')}>Tableau de bord</h1>

      <Table
        caption={"Dossiers"}
        data={rows}
        fixed
        headers={[
          'Dossier',
          'Requérant',
          'Défendeur',
          'Urgence',
          'État'
        ]}
      />
      <Pagination
        count={totalPages}
        defaultPage={currentPage}
        getPageLinkProps={(pageNumber: number) => ({
          href: `/dashboard?page=${pageNumber}`,
          scroll: false,
        })}
        showFirstLast
      />
    </>
  );
}
