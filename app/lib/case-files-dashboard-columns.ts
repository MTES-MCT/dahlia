import { type Prisma } from "@prisma/client";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type SortOrder } from "@/app/lib/table-sort";

// Relations required by the dashboard table and xlsx export. Kept in one place so
// fetch queries stay aligned with visible/exported columns.
export const CASE_FILES_DASHBOARD_INCLUDE = {
  mainClaimant: true,
  mainDefender: true,
  lastProducer: true,
  lastStatus: true,
  lastHearing: true,
} as const satisfies Prisma.CaseFileInclude;

export type CaseFileDashboardRow = Prisma.CaseFileGetPayload<{
  include: typeof CASE_FILES_DASHBOARD_INCLUDE;
}>;

// Sort key for the memory-production deadline column: the convocation date of
// the last hearing. It lives on the `lastHearing` relation, so it needs a
// dedicated nested orderBy (see buildOrderBy in case-files.ts).
export const HEARING_CONVOCATION_SORT_KEY = "convocationDate";

export type CaseFileDashboardColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultOrder?: SortOrder;
  facet?: boolean;
  facetKey?: string;
  exportValue: (row: CaseFileDashboardRow) => string;
};

// Shared column metadata for the dashboard table and xlsx export. UI-specific
// rendering (links, badges) is layered on top in the page component.
export const CASE_FILES_DASHBOARD_COLUMNS: CaseFileDashboardColumnDef[] = [
  {
    key: "caseFileNumber",
    facetKey: "dossier",
    label: "Dossier",
    sortable: true,
    facet: true,
    exportValue: (caseFile) => caseFile.caseFileNumber,
  },
  {
    key: "depositDate",
    label: "Date de réception",
    sortable: true,
    exportValue: (caseFile) => formatDateFr(caseFile.depositDate),
  },
  {
    key: "mainClaimant",
    facetKey: "requerant",
    label: "Requérant",
    sortable: true,
    facet: true,
    exportValue: (caseFile) => getActorDisplayName(caseFile.mainClaimant),
  },
  {
    key: "mainDefender",
    facetKey: "defendeur",
    label: "Défendeur",
    sortable: true,
    facet: true,
    exportValue: (caseFile) => getActorDisplayName(caseFile.mainDefender),
  },
  {
    key: "lastProducer",
    facetKey: "producteur",
    label: "Dernier producteur",
    sortable: true,
    facet: true,
    exportValue: (caseFile) => getActorDisplayName(caseFile.lastProducer),
  },
  {
    key: "status",
    facetKey: "statut",
    label: "Statut",
    facet: true,
    exportValue: (caseFile) => caseFile.lastStatus.label,
  },
  {
    key: HEARING_CONVOCATION_SORT_KEY,
    label: "Date limite de production de mémoire",
    sortable: true,
    defaultOrder: "ascending",
    exportValue: (caseFile) => formatDateFr(caseFile.lastHearing?.convocationDate),
  },
];
