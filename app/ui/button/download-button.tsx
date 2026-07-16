import { fr } from "@codegouvfr/react-dsfr";

type Props = {
  href: string;
  children?: React.ReactNode;
};

// Plain anchor (not a DSFR Button/Next Link) so the browser performs a real
// navigation to the route handler and triggers the file download.
export function DownloadButton({ href, children = "Télécharger les résultats" }: Props) {
  return (
    <a
      className={fr.cx(
        "fr-btn",
        "fr-btn--secondary",
        "fr-icon-download-line",
        "fr-btn--icon-left",
        "fr-mb-2w",
        "fr-btn--sm",
      )}
      href={href}
      download
    >
      {children}
    </a>
  );
}
