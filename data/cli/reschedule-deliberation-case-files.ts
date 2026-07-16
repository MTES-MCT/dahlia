import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, addMonths, addWeeks, setHours, setMilliseconds, setMinutes, setSeconds } from "date-fns";

const SOURCE_STATUS_LABEL = "En cours de déliberé";
const TARGET_STATUS_LABEL = "Inscrit au rôle d'une audience";

// Fallback Telerecours-like metadata when the target status is not in DB yet.
const TARGET_STATUS_FALLBACK = {
  id: 12,
  category: "C4",
  groupId: 5,
} as const;

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.includes("--dry-run") };
}

function hearingConvocationDateForIndex(index: number, now: Date): Date {
  const atNineAm = setMilliseconds(setSeconds(setMinutes(setHours(now, 9), 0), 0), 0);
  if (index === 0) return addDays(atNineAm, 2);
  if (index === 1) return addWeeks(atNineAm, 1);
  return addMonths(atNineAm, 1);
}

function devScheduledHearingId(caseFileNumber: string): string {
  return `dev-scheduled-${caseFileNumber}`;
}

async function ensureTargetStatus(prisma: PrismaClient) {
  const existing = await prisma.status.findFirst({
    where: { label: TARGET_STATUS_LABEL },
  });
  if (existing) return existing;

  console.warn(
    `Status "${TARGET_STATUS_LABEL}" not found — creating dev record id=${TARGET_STATUS_FALLBACK.id}.`,
  );
  return prisma.status.upsert({
    where: { id: TARGET_STATUS_FALLBACK.id },
    update: {
      label: TARGET_STATUS_LABEL,
      category: TARGET_STATUS_FALLBACK.category,
      groupId: TARGET_STATUS_FALLBACK.groupId,
    },
    create: {
      id: TARGET_STATUS_FALLBACK.id,
      label: TARGET_STATUS_LABEL,
      category: TARGET_STATUS_FALLBACK.category,
      groupId: TARGET_STATUS_FALLBACK.groupId,
    },
  });
}

async function main(): Promise<number> {
  const { dryRun } = parseArgs();
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const caseFiles = await prisma.caseFile.findMany({
      where: {
        isDeleted: false,
        lastStatus: { label: SOURCE_STATUS_LABEL },
      },
      select: {
        caseFileNumber: true,
        lastHearingId: true,
      },
      orderBy: { caseFileNumber: "asc" },
    });

    if (caseFiles.length === 0) {
      console.log(`No case files with status "${SOURCE_STATUS_LABEL}".`);
      return 0;
    }

    const targetStatus = dryRun
      ? (await prisma.status.findFirst({ where: { label: TARGET_STATUS_LABEL } })) ?? {
          id: TARGET_STATUS_FALLBACK.id,
          label: TARGET_STATUS_LABEL,
          category: TARGET_STATUS_FALLBACK.category,
          groupId: TARGET_STATUS_FALLBACK.groupId,
          labelNormalized: null,
        }
      : await ensureTargetStatus(prisma);

    const now = new Date();
    console.log(
      `${dryRun ? "[dry-run] Would update" : "Updating"} ${caseFiles.length} case file(s):`,
    );

    for (const [index, caseFile] of caseFiles.entries()) {
      const convocationDate = hearingConvocationDateForIndex(index, now);
      const hearingId = devScheduledHearingId(caseFile.caseFileNumber);
      const scheduleLabel =
        index === 0 ? "in 2 days" : index === 1 ? "in 1 week" : "in 1 month";

      console.log(
        `  ${caseFile.caseFileNumber}: status → "${TARGET_STATUS_LABEL}", ` +
          `hearing ${hearingId} → ${convocationDate.toISOString()} (${scheduleLabel})` +
          (caseFile.lastHearingId && caseFile.lastHearingId !== hearingId
            ? ` [was ${caseFile.lastHearingId}]`
            : ""),
      );

      if (dryRun) continue;

      await prisma.$transaction([
        prisma.hearing.upsert({
          where: { hearingId },
          update: {
            convocationDate,
            caseFileNumber: caseFile.caseFileNumber,
          },
          create: {
            hearingId,
            convocationDate,
            caseFileNumber: caseFile.caseFileNumber,
          },
        }),
        prisma.caseFile.update({
          where: { caseFileNumber: caseFile.caseFileNumber },
          data: {
            lastStatusId: targetStatus.id,
            lastStatusDate: now,
            lastHearingId: hearingId,
            lastHearingConvocationDate: convocationDate,
          },
        }),
      ]);
    }

    if (dryRun) {
      console.log("Dry run complete — no changes written.");
    } else {
      console.log("Done.");
    }

    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
