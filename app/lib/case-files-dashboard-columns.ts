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

// Sort key for the memory-production deadline column. The URL param is kept as
// `convocationDate` for backward compatibility; sorting uses the generated
// `memoryDeadlineDate` column in Postgres (see migration case_file_memory_deadline_date).
export const HEARING_CONVOCATION_SORT_KEY = "convocationDate";

export const MEMORY_DEADLINE_SOURCE_LABELS = {
  hearing: "Audience",
  MISE_EN_DEMEURE_DE_PRODUIRE: "Mise en demeure",
  CLOTURE_INSTRUCTION: "Clôture d'instruction",
} as const;

export type MemoryDeadlineSource = keyof typeof MEMORY_DEADLINE_SOURCE_LABELS;

export function getMemoryDeadlineDate(
  caseFile: Pick<CaseFileDashboardRow, "memoryDeadlineDate">,
): Date | null {
  return caseFile.memoryDeadlineDate;
}

export function getMemoryDeadlineSource(
  caseFile: Pick<
    CaseFileDashboardRow,
    "productionDeadlineDate" | "productionDeadlineType" | "lastHearing"
  >,
): MemoryDeadlineSource | null {
  if (caseFile.productionDeadlineDate) {
    if (caseFile.productionDeadlineType === "CLOTURE_INSTRUCTION") {
      return "CLOTURE_INSTRUCTION";
    }
    if (caseFile.productionDeadlineType === "MISE_EN_DEMEURE_DE_PRODUIRE") {
      return "MISE_EN_DEMEURE_DE_PRODUIRE";
    }
  }

  if (caseFile.lastHearing?.convocationDate) {
    return "hearing";
  }

  return null;
}

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
    exportValue: (caseFile) => formatDateFr(getMemoryDeadlineDate(caseFile)),
  },
];
