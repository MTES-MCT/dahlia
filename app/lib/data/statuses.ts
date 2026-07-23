import { prisma } from "@/app/lib/prisma";

// Distinct status labels from the Telerecours catalogue (`statuses`), sorted for
// the dashboard filter dropdown.
export async function fetchDashboardStatusFilterOptions(): Promise<string[]> {
  const rows = await prisma.status.findMany({
    select: { label: true },
    distinct: ["label"],
    orderBy: { label: "asc" },
  });

  return rows.map((row) => row.label).sort((a, b) => a.localeCompare(b, "fr"));
}
