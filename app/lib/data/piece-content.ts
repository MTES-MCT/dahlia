import "server-only";
import { type AttachedFileDetail } from "@/app/lib/data/attached-files";
import { pieceDownloadFileName } from "@/app/lib/piece-display";
import { getTelerecoursClientForCaseFile } from "@/app/lib/telerecours";
import { readMockedPdf } from "@/app/lib/mocked-pieces";

export type PieceContent = {
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  downloadName: string;
};

// Copy bytes into a fresh Uint8Array backed by a plain ArrayBuffer, so the
// result satisfies `BodyInit` (Response rejects Uint8Array<ArrayBufferLike>).
function toBytes(source: ArrayBufferView | ArrayBuffer): Uint8Array<ArrayBuffer> {
  const view =
    source instanceof Uint8Array
      ? source
      : ArrayBuffer.isView(source)
        ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
        : new Uint8Array(source);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy;
}

// Fetch a pièce's binary content, keeping the Télérecours access token on the
// backend. Outside production (unless NO_FAKE_FILE=true) we serve a fake PDF
// from `files/mocked_pdfs`. Shared by the single-file download route and the
// multi-file zip route so both stay in sync.
export async function fetchPieceContent(
  file: NonNullable<AttachedFileDetail>,
): Promise<PieceContent> {
  const downloadName = pieceDownloadFileName(file);

  if (process.env.ENVIRONMENT !== "production" && process.env.NO_FAKE_FILE !== "true") {
    const { data } = await readMockedPdf(file.fileTypeLabel);
    return { data: toBytes(data), mimeType: "application/pdf", downloadName };
  }

  // Credentials follow the case file's own jurisdiction (e.g. TA034 vs TA069).
  const { client, jurisdiction } = await getTelerecoursClientForCaseFile(file.caseFileNumber);
  const { data, mimeType } = await client.downloadFile(file.encodedFileId, jurisdiction);
  return {
    data: toBytes(data),
    mimeType: mimeType ?? file.mimeType ?? "application/octet-stream",
    downloadName,
  };
}
