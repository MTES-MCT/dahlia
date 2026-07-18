import { type Prisma } from "@prisma/client";
import {
  PRODUCTION_DEADLINE_TYPE_LABELS,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import { CASE_FILE_ACTOR_INCLUDE } from "@/app/lib/case-file-actors";
import {
  formatDateFr,
  getActorDisplayName,
  getCaseFileDisplayName,
} from "@/app/lib/case-file-format";
import { DOSSIER_FACET_FIELDS } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const CASE_FILES_DASHBOARD_INCLUDE = {
  caseFileActors: { include: CASE_FILE_ACTOR_INCLUDE },
  lastProducer: true,
  lastStatus: true,
  lastHearing: true,
} as const satisfies Prisma.CaseFileInclude;

export type CaseFileDashboardRow = Prisma.CaseFileGetPayload<{
  include: typeof CASE_FILES_DASHBOARD_INCLUDE;
}>;

export const HEARING_CONVOCATION_SORT_KEY = "convocationDate";

export type MemoryDeadlineSource = "hearing" | ProductionDeadlineType;

export const MEMORY_DEADLINE_SOURCE_LABELS: Record<MemoryDeadlineSource, string> = {
  hearing: "Audience",
  ...PRODUCTION_DEADLINE_TYPE_LABELS,
};

type MemoryDeadlineSourceInput = Pick<
  CaseFileDashboardRow,
  "productionDeadlineDate" | "productionDeadlineType"
> & {
  lastHearing: { convocationDate: Date | null } | null;
};

export function getMemoryDeadlineSource(
  caseFile: MemoryDeadlineSourceInput,
): MemoryDeadlineSource | null {
  if (caseFile.productionDeadlineDate) {
    const deadlineType = caseFile.productionDeadlineType;
    if (deadlineType && deadlineType in PRODUCTION_DEADLINE_TYPE_LABELS) {
      return deadlineType;
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
  facetFields?: readonly { key: string; label: string }[];
  width?: string;
  exportValue: (row: CaseFileDashboardRow) => string;
};

export const CASE_FILES_DASHBOARD_COLUMNS: CaseFileDashboardColumnDef[] = [
  {
    key: "caseFileNumber",
    label: "Dossier",
    sortable: true,
    facetFields: DOSSIER_FACET_FIELDS,
    width: "50%",
    exportValue: (caseFile) => getCaseFileDisplayName(caseFile),
  },
  {
    key: "depositDate",
    label: "Date de réception",
    sortable: true,
    width: "14%",
    exportValue: (caseFile) => formatDateFr(caseFile.depositDate),
  },
  {
    key: "lastProducer",
    label: "Dernier producteur",
    sortable: true,
    facetFields: [{ key: "producteur", label: "Dernier producteur" }],
    width: "18%",
    exportValue: (caseFile) => getActorDisplayName(caseFile.lastProducer),
  },
  {
    key: HEARING_CONVOCATION_SORT_KEY,
    label: "Date limite de production de mémoire",
    sortable: true,
    defaultOrder: "ascending",
    width: "18%",
    exportValue: (caseFile) => formatDateFr(caseFile.memoryDeadlineDate),
  },
];
