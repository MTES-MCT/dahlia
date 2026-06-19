import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import {
  fetchCaseFilesTableData,
  fetchUsedStatusLabels,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/data/case-files";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { ColumnHeader } from "@/app/ui/column-header";
import { MemoryDeadlineCell } from "@/app/ui/memory-deadline-cell";
import { CaseFilesSearch } from "@/app/ui/case-files-search";
import Link from "next/link";

const NUMBER_OF_CASE_FILES = 30;

// Status selected by default when arriving on the page (no `statut` param in the URL).
const DEFAULT_STATUT = "Inscrit au rôle d'une audience";

// Encode the status filter in URL query params so pagination and detail links preserve
// the user's selection (`statut=` for « Tous », default label when param is absent).
function setStatutSearchParam(
  params: URLSearchParams,
  statutParam: string | undefined,
  defaultStatut: string,
) {
  if (statutParam === undefined) {
    params.set("statut", defaultStatut);
  } else {
    params.set("statut", statutParam);
  }
}

type Props = {
  searchParams: Promise<{
    page?: string;
    sortBy: string;
    sortOrder: string;
    dahliaq?: string;
    statut?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const {
    page: pageParam,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    dahliaq: qParam,
    statut: statutParam,
  } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  // No sort in the URL → default to the memory-production deadline (convocation
  // date) in ascending order, so the most urgent deadlines come first.
  const currentSortBy = sortByParam ?? HEARING_CONVOCATION_SORT_KEY;
  const currentSortOrder = sortByParam ? (sortOrderParam ?? "descending") : "ascending";
  const currentQuery = qParam?.trim() ? qParam.trim() : null;
  // `statut` absent de l'URL (1ère arrivée) → on filtre par défaut sur DEFAULT_STATUT.
  // `statut` présent mais vide (`statut=`) → l'utilisateur a explicitement choisi « Tous ».
  const currentStatut =
    statutParam === undefined ? DEFAULT_STATUT : statutParam.trim() ? statutParam.trim() : null;

  const [{ rows, totalPages, totalCount }, statusOptions] = await Promise.all([
    fetchCaseFilesTableData(
      currentPage,
      NUMBER_OF_CASE_FILES,
      currentSortBy,
      currentSortOrder,
      currentQuery,
      currentStatut,
    ),
    fetchUsedStatusLabels(),
  ]);

  // Query string courant, transmis à la page de détail pour reconstruire le lien de retour
  // qui ramène l'utilisateur sur sa dernière recherche (page, tri, recherche, statut).
  const currentParams = new URLSearchParams();
  if (pageParam) currentParams.set("page", String(currentPage));
  if (currentSortBy) currentParams.set("sortBy", currentSortBy);
  if (sortOrderParam) currentParams.set("sortOrder", currentSortOrder);
  if (currentQuery) currentParams.set("dahliaq", currentQuery);
  setStatutSearchParam(currentParams, statutParam, DEFAULT_STATUT);
  const currentQueryString = currentParams.toString();

  return (
    <>
      <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>Affaires suivies par la DDETS du Rhône</h1>

      <CaseFilesSearch
        statusOptions={statusOptions}
        defaultStatut={DEFAULT_STATUT}
        currentQuery={currentQuery ?? ""}
        statutParam={statutParam}
        sortByParam={sortByParam}
        sortOrderParam={sortOrderParam}
      />

      <Table
        caption={`${totalCount} dossier${totalCount > 1 ? "s" : ""}`}
        data={rows.map(
          ([caseFileNumber, depositDate, claimant, defender, status, convocationDate]) => [
            <Link
              key={caseFileNumber}
              href={`/case_files/${encodeURIComponent(caseFileNumber)}${currentQueryString ? `?${currentQueryString}` : ""}`}
            >
              {caseFileNumber}
            </Link>,
            depositDate,
            claimant,
            defender,
            status,
            <MemoryDeadlineCell
              key={`${caseFileNumber}-deadline`}
              date={convocationDate}
              status={status}
            />,
          ],
        )}
        fixed
        headers={[
          <ColumnHeader
            key="caseFileNumber"
            label="Dossier"
            sortKey="caseFileNumber"
            facetKey="dossier"
          />,
          <ColumnHeader key="depositDate" label="Date de réception" sortKey="depositDate" />,
          <ColumnHeader
            key="mainClaimant"
            label="Requérant"
            sortKey="mainClaimant"
            facetKey="requerant"
          />,
          <ColumnHeader
            key="mainDefender"
            label="Défendeur"
            sortKey="mainDefender"
            facetKey="defendeur"
          />,
          <ColumnHeader key="status" label="Statut" facetKey="statut" />,
          <ColumnHeader
            key={HEARING_CONVOCATION_SORT_KEY}
            label="Date limite de production de mémoire"
            sortKey={HEARING_CONVOCATION_SORT_KEY}
            defaultOrder="ascending"
          />,
        ]}
      />
      <Pagination
        count={totalPages}
        defaultPage={currentPage}
        getPageLinkProps={(pageNumber: number) => {
          const params = new URLSearchParams({ page: String(pageNumber) });
          if (currentSortBy) params.set("sortBy", currentSortBy);
          if (currentSortOrder) params.set("sortOrder", currentSortOrder);
          if (currentQuery) params.set("dahliaq", currentQuery);
          setStatutSearchParam(params, statutParam, DEFAULT_STATUT);
          return { href: `/case_files?${params}`, scroll: false };
        }}
        showFirstLast
      />
    </>
  );
}
