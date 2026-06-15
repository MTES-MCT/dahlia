import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import {
  fetchCaseFilesTableData,
  fetchUsedStatusLabels,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/data/case-files";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { SortableColumnHeader } from "@/app/ui/sortable-column-header";
import { MemoryDeadlineCell } from "@/app/ui/memory-deadline-cell";
import { CaseFilesSearchBar } from "@/app/ui/case-files-search-bar";
import { CaseFilesSearchByStatus } from "@/app/ui/case-files-search-by-status";
import Link from "next/link";
import clsx from "clsx";

const NUMBER_OF_CASE_FILES = 30;

// Status selected by default when arriving on the page (no `statut` param in the URL).
const DEFAULT_STATUT = "Inscrit au rôle d'une audience";

type Props = {
  searchParams: Promise<{
    page?: string;
    sortBy: string;
    sortOrder: string;
    q?: string;
    statut?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const {
    page: pageParam,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    q: qParam,
    statut: statutParam,
  } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", NUMBER_OF_CASE_FILES) || 1);
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
  if (currentQuery) currentParams.set("q", currentQuery);
  if (currentStatut) currentParams.set("statut", currentStatut);
  const currentQueryString = currentParams.toString();

  return (
    <>
      <h1 className={fr.cx("fr-mt-3w", "fr-h2")}>Affaires suivies par la DDETS du Rhône</h1>

      <div className={clsx("flex", "flex-row", "gap-2", "items-end")}>
        <CaseFilesSearchByStatus options={statusOptions} defaultStatut={DEFAULT_STATUT} />
        <CaseFilesSearchBar className={clsx("flex-1", "fr-mb-3w")} />
      </div>

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
            <MemoryDeadlineCell key={`${caseFileNumber}-deadline`} date={convocationDate} />,
          ],
        )}
        fixed
        headers={[
          <SortableColumnHeader key="caseFileNumber" label="Dossier" sortKey="caseFileNumber" />,
          <SortableColumnHeader
            key="depositDate"
            label="Date de réception"
            sortKey="depositDate"
          />,
          <SortableColumnHeader key="mainClaimant" label="Requérant" sortKey="mainClaimant" />,
          <SortableColumnHeader key="mainDefender" label="Défendeur" sortKey="mainDefender" />,
          "Statut",
          <SortableColumnHeader
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
          if (currentQuery) params.set("q", currentQuery);
          if (currentStatut) params.set("statut", currentStatut);
          return { href: `/case_files?${params}`, scroll: false };
        }}
        showFirstLast
      />
    </>
  );
}
