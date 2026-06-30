import ExcelJS from "exceljs";
import { type NextRequest } from "next/server";
import {
  fetchAllCaseFilesForExport,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/data/case-files";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import { resolveCurrentStatut } from "@/app/lib/dashboard-filter";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";

// The export must read the live filter and run an unpaginated query, so it is
// fully dynamic and runs on the Node.js runtime (ExcelJS relies on Node APIs).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Columns of the exported sheet, mirroring the dashboard table but as plain
// text values (no React rendering, no urgency badge).
const EXPORT_COLUMNS: {
  header: string;
  value: (caseFile: Awaited<ReturnType<typeof fetchAllCaseFilesForExport>>[number]) => string;
}[] = [
  { header: "Dossier", value: (c) => c.caseFileNumber },
  { header: "Date de réception", value: (c) => formatDateFr(c.depositDate) },
  { header: "Requérant", value: (c) => getActorDisplayName(c.mainClaimant) },
  { header: "Défendeur", value: (c) => getActorDisplayName(c.mainDefender) },
  { header: "Dernier producteur", value: (c) => getActorDisplayName(c.lastProducer) },
  { header: "Statut", value: (c) => c.lastStatus.label },
  {
    header: "Date limite de production de mémoire",
    value: (c) => formatDateFr(c.lastHearing?.convocationDate),
  },
];

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);

  const tableState = parseTableQueryState(searchParams, DASHBOARD_TABLE_PARAMS, {
    defaultSortBy: HEARING_CONVOCATION_SORT_KEY,
    defaultOrder: searchParams.sortBy ? "descending" : "ascending",
  });
  const currentStatut = resolveCurrentStatut(searchParams.statut);

  const caseFiles = await fetchAllCaseFilesForExport(
    tableState.sortBy,
    tableState.sortOrder,
    tableState.query,
    currentStatut,
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Dossiers");
  worksheet.addRow(EXPORT_COLUMNS.map((column) => column.header));
  worksheet.getRow(1).font = { bold: true };
  for (const caseFile of caseFiles) {
    worksheet.addRow(EXPORT_COLUMNS.map((column) => column.value(caseFile)));
  }
  worksheet.columns.forEach((column) => {
    column.width = 30;
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `dossiers-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
