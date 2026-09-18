import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import clsx from "clsx";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { tagBadgeClassName } from "@/app/lib/tag-colors";

export type TagBadgeProps = {
  tag: Pick<CaseFileTagView, "label" | "color">;
  // Adds a trailing close icon. The badge itself stays inert: the caller wraps
  // it in the `<button>` that performs the removal and carries its label.
  removable?: boolean;
};

// A tag, always rendered as a small DSFR badge rather than a DSFR tag: tag
// accents are only styled on interactive elements (`a`, `button`), so a
// `<span>` tag would always render grey whatever its colour.
export function TagBadge({ tag, removable = false }: TagBadgeProps) {
  return (
    <Badge as="span" small noIcon className={fr.cx(tagBadgeClassName(tag.color))}>
      {tag.label}
      {removable ? (
        <span
          className={clsx(fr.cx("fr-icon-close-line", "fr-icon--xs"), "ml-1")}
          aria-hidden="true"
        />
      ) : null}
    </Badge>
  );
}
