import { upsertStatusCatalog } from "../persistence/upsert-status-catalog";
import type { Args, ScrapeDeps } from "./pipeline";

// ───── Phase A.0: sync the Telerecours statuses catalogue ─────

export async function phaseA0(args: Args, deps: ScrapeDeps): Promise<void> {
  const { client, prisma } = deps;
  console.log(`\n══ Phase A.0 — sync catalogue statuts (${args.jurisdiction}) ══`);

  const groups = await client.getStatusGroups(args.jurisdiction, "ALL");
  console.log(`✓ ${groups.length} groupes de statut ALL récupérés`);

  const { upserted, skipped } = await upsertStatusCatalog(prisma, groups);
  console.log(`✓ Phase A.0 : ${upserted} statut(s) upserté(s) (${skipped} ignoré(s)).`);
}
