import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { getTelerecoursClient } from "@/app/lib/telerecours";
import { describeError } from "@/data/telerecours/http";

type RouteContext = {
  params: Promise<{ caseFileNumber: string; encodedFileId: string }>;
};

// Stream a pièce's binary content from Télérecours through our backend, so the
// access token never reaches the browser. We verify the file actually belongs
// to the requested case file before downloading anything.
export async function GET(_request: Request, { params }: RouteContext) {
  const { caseFileNumber, encodedFileId } = await params;
  const decodedCaseFileNumber = decodeURIComponent(caseFileNumber);
  const decodedFileId = decodeURIComponent(encodedFileId);

  const file = await fetchAttachedFile(decodedFileId);
  if (!file || file.caseFileNumber !== decodedCaseFileNumber) {
    return new Response("Pièce introuvable", { status: 404 });
  }

  try {
    const { client, jurisdiction } = getTelerecoursClient();
    const { data, mimeType, fileName } = await client.downloadFile(decodedFileId, jurisdiction);

    // RFC 5987-encoded filename so accented names survive the header.
    const downloadName = fileName ?? file.originalFileName;
    const asciiName = downloadName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType ?? file.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        // Per-user content: cache in the browser only, briefly.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return new Response(`Échec du téléchargement de la pièce : ${describeError(error)}`, {
      status: 502,
    });
  }
}
