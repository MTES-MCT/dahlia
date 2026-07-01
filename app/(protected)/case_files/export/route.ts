import ExcelJS from "exceljs";
import { type NextRequest } from "next/server";
import { fetchAllCaseFilesForExport } from "@/app/lib/data/case-files";
import {
  CASE_FILES_DASHBOARD_COLUMNS,
  HEARING_CONVOCATION_SORT_KEY,
} from "@/app/lib/case-files-dashboard-columns";
import { DASHBOARD_TABLE_PARAMS } from "@/app/lib/case-file-search";
import { parseTableQueryState } from "@/app/lib/table-query-state";
import { resolveCurrentStatut } from "@/app/lib/dashboard-filter";

// The export must read the live filter and run an unpaginated query, so it is
// fully dynamic and runs on the Node.js runtime (ExcelJS relies on Node APIs).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_COLUMNS = CASE_FILES_DASHBOARD_COLUMNS.map((column) => ({
  header: column.label,
  value: column.exportValue,
}));

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
