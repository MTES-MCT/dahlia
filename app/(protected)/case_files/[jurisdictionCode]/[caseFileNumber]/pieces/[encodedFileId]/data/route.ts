import { clientErrorMessage } from "@/app/lib/client-error";
import { caseFileKeyFromParams } from "@/app/lib/case-file-key";
import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { fetchPieceContent } from "@/app/lib/data/piece-content";

type RouteContext = {
  params: Promise<{ jurisdictionCode: string; caseFileNumber: string; encodedFileId: string }>;
};

// Stream a pièce's binary content from Télérecours through our backend, so the
// access token never reaches the browser. We verify the file actually belongs
// to the requested case file (lookup by case-file key) before downloading anything.
export async function GET(_request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const key = caseFileKeyFromParams(resolvedParams);
  const decodedFileId = decodeURIComponent(resolvedParams.encodedFileId);

  // Null (and recorded by `fetchAttachedFile`) when unknown, attached to another
  // case file or out of the caller's scope.
  const file = await fetchAttachedFile(key, decodedFileId);
  if (!file) {
    return new Response("Pièce introuvable", { status: 404 });
  }

  try {
    const { data, mimeType, downloadName } = await fetchPieceContent(file);

    // RFC 5987-encoded filename so accented names survive the header.
    const asciiName = downloadName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

    return new Response(data, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        // Per-user content: cache in the browser only, briefly.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return new Response(clientErrorMessage(error, "Échec du téléchargement de la pièce"), {
      status: 502,
    });
  }
}
