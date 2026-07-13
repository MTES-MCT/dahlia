import { zipSync } from "fflate";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { fetchPieceContent } from "@/app/lib/data/piece-content";
import { describeError } from "@/data/telerecours/http";

// The download reads live per-user content and relies on Node.js APIs, so it is
// fully dynamic and runs on the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ caseFileNumber: string }>;
};

// Ensure every entry has a unique name inside the archive: append " (2)", " (3)"…
// before the extension when the same display name shows up more than once.
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.indexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let index = 1;
  let candidate = `${base} (${index})${ext}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base} (${index})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

// Zip the requested pièces and stream the archive back. The selected files are
// passed as repeated `id` query params (a download is a read, hence GET). Each
// file is fetched through the backend (token stays server-side) and verified to
// belong to the requested case file before being included.
export async function GET(request: Request, { params }: RouteContext) {
  const { caseFileNumber } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);

  const encodedFileIds = new URL(request.url).searchParams.getAll("id");

  if (encodedFileIds.length === 0) {
    return new Response("Aucune pièce sélectionnée", { status: 400 });
  }

  try {
    const usedNames = new Set<string>();
    const entries: Record<string, Uint8Array> = {};

    for (const encodedFileId of encodedFileIds) {
      const file = await fetchAttachedFile(encodedFileId);
      if (!file || file.caseFileNumber !== decodedCaseFileNumber) {
        return new Response(`Pièce introuvable : ${encodedFileId}`, { status: 404 });
      }
      const { data, downloadName } = await fetchPieceContent(file);
      entries[uniqueName(downloadName, usedNames)] = data;
    }

    // PDFs are already compressed; skip deflate to keep the response fast.
    const zipped = zipSync(entries, { level: 0 });

    const zipName = `pieces-${decodedCaseFileNumber}-${new Date().toISOString().slice(0, 10)}.zip`;
    const asciiZipName = zipName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

    return new Response(new Uint8Array(zipped), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${asciiZipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(`Échec du téléchargement des pièces : ${describeError(error)}`, {
      status: 502,
    });
  }
}
