import { PrismaClient } from "@prisma/client";
import { TelerecoursClient } from "../telerecours/client.interface";
import { phaseA, reconcileDeleted } from "./phase-a-list";
import { phaseB } from "./phase-b-enrich";
import { phaseC } from "./phase-c-related";

// Resolved run configuration (CLI args + env defaults), see cli/parse-args.ts.
export interface Args {
  jurisdiction: string;
  page: number;
  size: number;
  sort?: string;
  all: boolean;
  legalEntityDivisionIds: number[];
  anonymize: boolean;
  skipEnrichment: boolean;
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

// Orchestrate the full scrape: A (list) → A.5 (reconcile) → B (enrich) →
// C (related links). Returns a process exit code (0 ok, 2 when nothing scraped).
export async function runScrape(args: Args, deps: ScrapeDeps): Promise<number> {
  const a = await phaseA(args, deps);
  if (a.processed === 0) {
    console.error("⚠ No case files retrieved.");
    return 2;
  }

  await reconcileDeleted(args, a.seen, deps);

  if (!args.skipEnrichment) {
    await phaseB(args, deps);
    await phaseC(args, deps);
  } else {
    console.log("→ --skipEnrichment : phases B et C ignorées.");
  }

  return 0;
}
