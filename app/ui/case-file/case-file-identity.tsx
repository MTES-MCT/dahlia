import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import clsx from "clsx";
import { statusBadgeAccentuationClassName } from "@/app/lib/status-badge-accentuation";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { TagBadge } from "@/app/ui/case-file/tag-badge";

export function CaseFileTagList({ tags }: { tags: CaseFileTagView[] }) {
  if (tags.length === 0) return null;

  return (
    <ul
      aria-label="Tags du dossier"
      className={clsx(fr.cx("fr-mt-1v", "fr-mb-0", "fr-pl-0"), "flex list-none flex-wrap gap-1")}
    >
      {tags.map((tag) => (
        <li key={tag.id} className="list-none">
          <TagBadge tag={tag} />
        </li>
      ))}
    </ul>
  );
}

type CaseFileIdentityName =
  // Dashboard cell: the display name links to the case file.
  | { kind: "link"; href: string }
  // Detail page: the display name is the page heading, next to a folder icon.
  | { kind: "heading" };

export type CaseFileIdentityProps = {
  displayName: string;
  title: string | null;
  statusLabel: string;
  tags: CaseFileTagView[];
  name: CaseFileIdentityName;
  // Trailing slot aligned to the right of the block, e.g. the "Détails du
  // dossier" button on the detail page. Absent in the table cell.
  actions?: React.ReactNode;
};

// Single rendering of a case file's identity — display name, Télérecours title,
// status badge and tags — shared by the dashboard table cell and the detail page
// header so the two can no longer drift apart.
export function CaseFileIdentity({
  displayName,
  title,
  statusLabel,
  tags,
  name,
  actions,
}: CaseFileIdentityProps) {
  const trimmedTitle = title?.trim();
  const isHeading = name.kind === "heading";

  const identity = (
    <div>
      {isHeading ? (
        <h1 className={fr.cx("fr-h4", "fr-mb-1v")}>{displayName}</h1>
      ) : (
        <Link href={name.href}>{displayName}</Link>
      )}

      {trimmedTitle ? (
        <p className={clsx(fr.cx("fr-mb-1v", "fr-mt-1v"), "text-(--text-mention-grey) italic")}>
          {trimmedTitle}
        </p>
      ) : null}

      <div className={clsx(!isHeading && fr.cx("fr-mt-1v"))}>
        <Badge as="span" noIcon className={fr.cx(statusBadgeAccentuationClassName(statusLabel))}>
          {statusLabel}
        </Badge>
      </div>

      <CaseFileTagList tags={tags} />
    </div>
  );

  if (!isHeading && !actions) {
    return identity;
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-4 lg:flex-row lg:items-start lg:justify-between",
      )}
    >
      <div className="flex items-start gap-3">
        {isHeading ? (
          <span
            className={clsx(
              fr.cx("fr-icon-folder-2-line", "fr-mt-1v"),
              "text-(--text-action-high-blue-france)",
            )}
            aria-hidden="true"
          />
        ) : null}
        {identity}
      </div>

      {actions}
    </div>
  );
}
