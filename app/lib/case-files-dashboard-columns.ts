import { type Prisma } from "@prisma/client";
import {
  litigationTypeLabel,
  PRODUCTION_DEADLINE_TYPE_LABELS,
  rightTypeLabel,
  type ProductionDeadlineType,
} from "@/app/lib/case-file-enums";
import {
  CASE_FILE_ACTOR_INCLUDE,
  getMainClaimantActor,
  getMainDefenderActor,
  getOtherCaseFileActors,
} from "@/app/lib/case-file-actors";
import {
  formatDateFr,
  getActorDisplayName,
  getCaseFileDisplayName,
} from "@/app/lib/case-file-format";
import { DOSSIER_FACET_FIELDS } from "@/app/lib/case-file-search";
import { type SortOrder } from "@/app/lib/table-sort";

export const CASE_FILES_DASHBOARD_INCLUDE = {
  caseFileActors: { include: CASE_FILE_ACTOR_INCLUDE },
  caseFileTags: { include: { tag: true }, orderBy: { tag: { label: "asc" } } },
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

function exportMemoryDeadlineSource(caseFile: CaseFileDashboardRow): string {
  const source = getMemoryDeadlineSource(caseFile);
  return source ? MEMORY_DEADLINE_SOURCE_LABELS[source] : "";
}

function exportOtherActors(caseFile: CaseFileDashboardRow): string {
  return getOtherCaseFileActors(caseFile)
    .map((link) => `${link.quality.name} : ${getActorDisplayName(link.actor)}`)
    .join(", ");
}

// Extra spreadsheet columns so the export carries identity fields shown inside
// the Dossier cell, the memory-deadline source shown as a badge, and the
// classification / actors otherwise only visible in the details modal.
export const CASE_FILES_EXPORT_COLUMNS: CaseFileDashboardColumnDef[] = [
  ...CASE_FILES_DASHBOARD_COLUMNS,
  {
    key: "memoryDeadlineSource",
    label: "Type d'échéance",
    exportValue: exportMemoryDeadlineSource,
  },
  {
    key: "lastStatus",
    label: "Statut",
    exportValue: (caseFile) => caseFile.lastStatus.label,
  },
  {
    key: "title",
    label: "Titre Télérecours",
    exportValue: (caseFile) => caseFile.title?.trim() ?? "",
  },
  {
    key: "tags",
    label: "Tags",
    exportValue: (caseFile) => caseFile.caseFileTags.map(({ tag }) => tag.label).join(", "),
  },
  {
    key: "rightType",
    label: "Droit opposable",
    exportValue: (caseFile) => rightTypeLabel(caseFile.rightType) ?? "",
  },
  {
    key: "litigationType",
    label: "Type de recours",
    exportValue: (caseFile) => litigationTypeLabel(caseFile.litigationType) ?? "",
  },
  {
    key: "mainClaimant",
    label: "Requérant",
    exportValue: (caseFile) => getActorDisplayName(getMainClaimantActor(caseFile)),
  },
  {
    key: "mainDefender",
    label: "Défendeur",
    exportValue: (caseFile) => getActorDisplayName(getMainDefenderActor(caseFile)),
  },
  {
    key: "otherActors",
    label: "Autres acteurs",
    exportValue: exportOtherActors,
  },
];
