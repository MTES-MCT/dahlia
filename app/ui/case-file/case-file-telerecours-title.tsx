import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";

type Props = {
  title: string | null;
  // The Dahlia display name shown above; the title is skipped when it would
  // only repeat it.
  displayName: string;
  // Page header only: keep the title on one line, ellipsed when too long (the
  // full title stays available as a tooltip).
  singleLine?: boolean;
};

// Télérecours title of a case file, rendered as a grey italic line under its
// Dahlia display name (detail page header, dashboard cell, related case files).
export function CaseFileTelerecoursTitle({ title, displayName, singleLine = false }: Props) {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle === displayName.trim()) return null;

  return (
    <p
      className={clsx(
        fr.cx("fr-text--sm", "fr-mb-1v", "fr-mt-1v"),
        "text-(--text-mention-grey) italic",
        singleLine && "truncate",
      )}
      title={singleLine ? trimmedTitle : undefined}
    >
      {trimmedTitle}
    </p>
  );
}
