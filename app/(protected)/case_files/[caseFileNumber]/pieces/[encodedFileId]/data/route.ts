import { fetchAttachedFile } from "@/app/lib/data/attached-files";
import { pieceDownloadFileName } from "@/app/lib/piece-display";
import { getTelerecoursClient } from "@/app/lib/telerecours";
import { readMockedPdf } from "@/app/lib/mocked-pieces";
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

  // Outside production, serve a fake PDF from `files/mocked_pdfs` unless
  // NO_FAKE_FILE=true (e.g. to exercise real Télérecours downloads locally).
  if (process.env.ENVIRONMENT !== "production" && process.env.NO_FAKE_FILE !== "true") {
    try {
      const { data } = await readMockedPdf(file.fileTypeLabel);
      const downloadName = pieceDownloadFileName(file);
      const asciiName = downloadName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return new Response(`Échec du chargement de la pièce simulée : ${describeError(error)}`, {
        status: 500,
      });
    }
  }

  try {
    const { client, jurisdiction } = getTelerecoursClient();
    const { data, mimeType } = await client.downloadFile(decodedFileId, jurisdiction);

    // RFC 5987-encoded filename so accented names survive the header.
    const downloadName = pieceDownloadFileName(file);
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
