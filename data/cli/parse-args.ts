import type { Args } from "../scrape/pipeline";

export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export function parseDivisionIds(value: string): number[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

// Parse process.argv into the resolved run configuration. Defaults come from the
// environment when not provided on the CLI (anonymize unless production,
// divisions from <JURISDICTION>_TELERECOURS_DIVISIONS).
export function parseArgs(argv: string[] = process.argv): Args {
  const args: Args = {
    jurisdiction: "TA069",
    page: 0,
    size: 30,
    sort: undefined,
    all: false,
    legalEntityDivisionIds: [],
    // Default: anonymize unless running against the prod environment.
    anonymize: process.env.ENVIRONMENT !== "production",
    skipEnrichment: false,
    updatePieceNumbers: false,
    classify: false,
    classifyOverwrite: false,
  };

  // Distinguish an explicit --legalEntityDivisionIds from the env-derived
  // default (resolved afterwards, since it depends on the jurisdiction).
  let divisionIdsFromCli = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--jurisdiction" && i + 1 < argv.length) {
      args.jurisdiction = argv[++i];
    } else if (arg === "--page" && i + 1 < argv.length) {
      args.page = parseInt(argv[++i], 10);
    } else if (arg === "--size" && i + 1 < argv.length) {
      args.size = parseInt(argv[++i], 10);
    } else if (arg === "--sort" && i + 1 < argv.length) {
      args.sort = argv[++i];
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--legalEntityDivisionIds" && i + 1 < argv.length) {
      args.legalEntityDivisionIds = parseDivisionIds(argv[++i]);
      divisionIdsFromCli = true;
    } else if (arg === "--anonymize") {
      args.anonymize = true;
    } else if (arg === "--no-anonymize") {
      args.anonymize = false;
    } else if (arg === "--skipEnrichment") {
      args.skipEnrichment = true;
    } else if (arg === "--update-piece-numbers") {
      args.updatePieceNumbers = true;
    } else if (arg === "--classify") {
      args.classify = true;
    } else if (arg === "--classify-overwrite") {
      // Implies --classify: asking for a rewrite without running the phase
      // would silently do nothing.
      args.classify = true;
      args.classifyOverwrite = true;
    }
  }

  // Default for divisions: <JURISDICTION>_TELERECOURS_DIVISIONS env var
  // (e.g. TA069_TELERECOURS_DIVISIONS=2488,1234), unless provided via CLI.
  // If neither is set, the array stays empty and the division filter is simply
  // not applied (all divisions of the jurisdiction are scraped).
  if (!divisionIdsFromCli) {
    const envValue = process.env[`${args.jurisdiction}_TELERECOURS_DIVISIONS`];
    if (envValue) {
      args.legalEntityDivisionIds = parseDivisionIds(envValue);
      console.log("legalEntityDivisionIds set to", args.legalEntityDivisionIds);
    }
  }

  console.log("--------------------------------------------------");
  console.log("ARGUMENTS:");
  console.log("  - jurisdiction set to", args.jurisdiction);
  console.log("  - page set to", args.page);
  console.log("  - size set to", args.size);
  console.log("  - sort set to", args.sort);
  console.log("  - all set to", args.all);
  console.log("  - legalEntityDivisionIds set to", args.legalEntityDivisionIds);
  console.log("  - anonymize set to", args.anonymize);
  console.log("  - skipEnrichment set to", args.skipEnrichment);
  console.log("  - updatePieceNumbers set to", args.updatePieceNumbers);
  console.log("  - classify set to", args.classify);
  console.log("  - classifyOverwrite set to", args.classifyOverwrite);
  console.log("  - divisionIdsFromCli set to", divisionIdsFromCli);
  console.log("--------------------------------------------------");
  return args;
}
