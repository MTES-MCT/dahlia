import { fr } from "@codegouvfr/react-dsfr";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import type { AttachedFileDetail } from "@/app/lib/data/attached-files";

type Props = {
  file: NonNullable<AttachedFileDetail>;
};

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <li className={fr.cx("fr-mb-1v")}>
      <strong>{label}</strong> : {value || "—"}
    </li>
  );
}

// Read-only Télérecours metadata for a pièce (file name, type, MIME, etc.).
export function PieceMetadata({ file }: Props) {
  return (
    <>
      <h3>Métadonnées de la pièce</h3>
      <ul className={fr.cx("fr-mb-3w")} style={{ listStyle: "none", paddingLeft: 0 }}>
        <MetadataItem label="Nom du fichier" value={file.originalFileName} />
        <MetadataItem label="Type de pièce" value={file.fileTypeLabel} />
        <MetadataItem label="Famille de pièce" value={file.fileFamilyType.label} />
        <MetadataItem label="Type de document" value={file.documentType} />
        <MetadataItem
          label="Propriétaire"
          value={file.event?.actor ? getActorDisplayName(file.event.actor) : ""}
        />
        <MetadataItem label="Format (MIME)" value={file.mimeType} />
        <MetadataItem label="Date de création" value={formatDateFr(file.eventCreationDate)} />
        <MetadataItem label="Identifiant Télérecours" value={file.encodedFileId} />
      </ul>
    </>
  );
}
