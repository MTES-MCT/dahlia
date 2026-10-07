import { refreshCaseFile } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/actions";
import { caseFileKeyFromParams } from "@/app/lib/case-file-key";

// Background Télérecours sync for the case-file page. Exposed as a Route Handler
// rather than a Server Action so the client can `fetch()` it without Next.js
// wrapping the call in startTransition (which would freeze the page).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jurisdictionCode: string; caseFileNumber: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const result = await refreshCaseFile(caseFileKeyFromParams(await params));
  return Response.json(result);
}
