import { fr } from "@codegouvfr/react-dsfr";

type Props = {
  // Backend route streaming the binary content of the pièce.
  dataUrl: string;
  mimeType: string;
  fileName: string;
};

// Left-column preview of a pièce. Images are shown with <img>, everything else
// (PDF mostly) is embedded with <object>; both fall back to a download link when
// the browser cannot render the content inline.
export function PieceViewer({ dataUrl, mimeType, fileName }: Props) {
  const isImage = mimeType.startsWith("image/");

  return (
    <div
      style={{
        border: "1px solid var(--border-default-grey)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        backgroundColor: "var(--background-alt-grey)",
        height: "90vh",
      }}
    >
      {isImage ? (
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={fileName}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      ) : (
        <object data={dataUrl} type={mimeType} width="100%" height="100%">
          <div className={fr.cx("fr-p-3w")}>
            <p>Impossible d&apos;afficher cette pièce directement dans le navigateur.</p>
            <a
              className={fr.cx("fr-link", "fr-icon-download-line", "fr-link--icon-left")}
              href={dataUrl}
            >
              Télécharger « {fileName} »
            </a>
          </div>
        </object>
      )}
    </div>
  );
}
