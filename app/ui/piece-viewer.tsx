import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";

type Props = {
  // Backend route streaming the binary content of the pièce.
  dataUrl: string;
  mimeType: string;
  fileName: string;
};

// Chromium PDF viewer open parameter: collapse the side navigation pane on load.
function embeddedDocumentDataUrl(dataUrl: string): string {
  const [base, hash = ""] = dataUrl.split("#", 2);
  const params = new URLSearchParams(hash);
  params.set("navpanes", "0");
  return `${base}#${params.toString()}`;
}

// Left-column preview of a pièce. Images are shown with <img>, everything else
// (PDF mostly) is embedded with <object>; both fall back to a download link when
// the browser cannot render the content inline.
export function PieceViewer({ dataUrl, mimeType, fileName }: Props) {
  const isImage = mimeType.startsWith("image/");

  return (
    <div
      className={clsx(
        "flex",
        "min-h-0",
        "flex-1",
        "flex-col",
        "overflow-hidden",
        "rounded-lg",
        "border",
        "border-solid",
        "border-(--border-default-grey)",
        "bg-(--background-alt-grey)",
      )}
    >
      {isImage ? (
        <div className={clsx("flex", "min-h-0", "flex-1", "items-center", "justify-center", "p-4")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={fileName}
            className={clsx("max-h-full", "max-w-full", "object-contain")}
          />
        </div>
      ) : (
        <object
          data={embeddedDocumentDataUrl(dataUrl)}
          type={mimeType}
          className={clsx("min-h-0", "w-full", "flex-1")}
        >
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
