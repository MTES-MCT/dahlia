import { PrismaClient } from "@prisma/client";
import { TelerecoursClient } from "../telerecours/client.interface";
import { phaseA0 } from "./phase-a0-status-catalog";
import { phaseA, reconcileDeleted } from "./phase-a-list";
import { phaseB } from "./phase-b-enrich";
import { phaseC } from "./phase-c-related";
import { phaseD } from "./phase-d-classify";

export const ENRICH_MODES = ["all", "ongoing", "none"] as const;
export type EnrichMode = (typeof ENRICH_MODES)[number];

// Resolved run configuration (CLI args + env defaults), see cli/parse-args.ts.
export interface Args {
  jurisdiction: string;
  page: number;
  size: number;
  sort?: string;
  all: boolean;
  legalEntityDivisionIds: number[];
  anonymize: boolean;
  // Phase B/C target set: ongoing (default, skip "Terminé"), all (include
  // closed), or none (skip phases B and C).
  enrich: EnrichMode;
  // Phase B — seed attached files' empty dahliaName from their file name.
  updatePieceName: boolean;
  // Phases B/C — delete the events, attached files and related-case-file links
  // stored for a case file but no longer returned by Telerecours.
  force: boolean;
  // Phase D — deduce litigationType / rightType / summary from the scraped text.
  classify: boolean;
  // Phase D — also rewrite characteristics that already have a value.
  classifyOverwrite: boolean;
}

// Everything the pipeline needs from the outside world. Injected so the phases
// can be driven against a fake client and a mocked Prisma in tests.
export interface ScrapeDeps {
  prisma: PrismaClient;
  client: TelerecoursClient;
  // Delay (ms) between per-item API calls to stay under Telerecours rate
  // limits. Defaults per phase when omitted; set to 0 in tests.
  rateLimitMs?: number;
}

// Orchestrate the full scrape: A.0 (status catalogue) → A (list) → A.5
// (reconcile) → B (enrich) → C (related links) → D (classification, opt-in).
// Returns a process exit code (0 ok, 1 when some list pages failed, 2 when
// nothing was scraped).
export async function runScrape(args: Args, deps: ScrapeDeps): Promise<number> {
  await phaseA0(args, deps);

  const a = await phaseA(args, deps);
  if (a.processed === 0) {
    console.error("⚠ No case files retrieved.");
    logFailedPages(a.failedPages);
    return a.failedPages.length > 0 ? 1 : 2;
  }

  // A skipped list page is absent from `seen`. Reconciling anyway would
  // soft-delete dossiers that still exist in Telerecours.
  if (a.failedPages.length > 0) {
    console.error(
      `⚠ Phase A.5 ignorée : la liste est incomplète ` +
        `(${a.failedPages.length} page(s) en erreur).`,
    );
  } else {
    await reconcileDeleted(args, a.seen, deps);
  }

  if (args.enrich !== "none") {
    await phaseB(args, deps);
    await phaseC(args, deps);
  } else {
    console.log("→ --enrich none : phases B et C ignorées.");
  }

  if (args.classify) {
    await phaseD(args, deps);
  }

  logFailedPages(a.failedPages);
  return a.failedPages.length > 0 ? 1 : 0;
}

function logFailedPages(failedPages: number[]): void {
  if (failedPages.length === 0) return;
  console.error(
    `⚠ Bilan : ${failedPages.length} page(s) en erreur (index API, 0-based) : ` +
      failedPages.join(", "),
  );
}
