import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";

type Props = {
  title: string | null;
  // The Dahlia display name shown above; the title is skipped when it would
  // only repeat it.
  displayName: string;
  // Page header and related case files: keep the title on one line, ellipsed
  // when too long (the full title stays available as a tooltip).
  singleLine?: boolean;
  // `span` where a <p> is not allowed, e.g. inside the pièces sidebar <button>.
  as?: "p" | "span";
};

// Télérecours title of a case file, rendered as a grey italic line under its
// Dahlia display name (detail page header, dashboard cell, related case files).
export function CaseFileTelerecoursTitle({
  title,
  displayName,
  singleLine = false,
  as: Tag = "p",
}: Props) {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle === displayName.trim()) return null;

  return (
    <Tag
      className={clsx(
        fr.cx("fr-text--sm", "fr-my-1v"),
        Tag === "span" && "block",
        "text-(--text-mention-grey) italic",
        singleLine && "truncate",
      )}
      title={singleLine ? trimmedTitle : undefined}
    >
      {trimmedTitle}
    </Tag>
  );
}
