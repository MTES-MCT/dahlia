import { type Prisma } from "@prisma/client";
import {
  PRODUCTION_DEADLINE_TYPE_LABELS,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import {
  CASE_FILE_ACTOR_INCLUDE,
  getMainClaimantActor,
  getMainDefenderActor,
} from "@/app/lib/case-file-actors";
import { formatDateFr, getActorDisplayName, getCaseFileDisplayName } from "@/app/lib/case-file-format";
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
  facet?: boolean;
  facetKey?: string;
  exportValue: (row: CaseFileDashboardRow) => string;
};

export const CASE_FILES_DASHBOARD_COLUMNS: CaseFileDashboardColumnDef[] = [
  {
    key: "caseFileNumber",
    facetKey: "dossier",
    label: "Dossier",
    sortable: true,
    facet: true,
    exportValue: (caseFile) => getCaseFileDisplayName(caseFile),
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
    facet: true,
    exportValue: (caseFile) => getActorDisplayName(getMainClaimantActor(caseFile)),
  },
  {
    key: "mainDefender",
    facetKey: "defendeur",
    label: "Défendeur",
    facet: true,
    exportValue: (caseFile) => getActorDisplayName(getMainDefenderActor(caseFile)),
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
    exportValue: (caseFile) => formatDateFr(caseFile.memoryDeadlineDate),
  },
];
