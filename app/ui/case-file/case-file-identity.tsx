import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import clsx from "clsx";
import { statusBadgeAccentuationClassName } from "@/app/lib/status-badge-accentuation";
import { type CaseFileTagView } from "@/app/lib/case-file-tags";
import { CaseFileTelerecoursTitle } from "@/app/ui/case-file/case-file-telerecours-title";
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
  // Detail page: "Dossier <display name>" is the page heading.
  | { kind: "heading" };

export type CaseFileIdentityProps = {
  displayName: string;
  title: string | null;
  statusLabel: string;
  // Shown in the dashboard cell only; the detail page header has no tags.
  tags?: CaseFileTagView[];
  name: CaseFileIdentityName;
  // Rendered to the right of the status badge, wrapping under it when space runs
  // out, e.g. the Télérecours sync notice on the detail page. Absent in the table cell.
  footer?: React.ReactNode;
};

// Single rendering of a case file's identity — display name, Télérecours title,
// status badge and tags — shared by the dashboard table cell and the detail page
// header so the two can no longer drift apart.
export function CaseFileIdentity({
  displayName,
  title,
  statusLabel,
  tags = [],
  name,
  footer,
}: CaseFileIdentityProps) {
  const isHeading = name.kind === "heading";

  return (
    <div>
      {isHeading ? (
        <h1 className={fr.cx("fr-h3", "fr-mb-1v")}>Dossier {displayName}</h1>
      ) : (
        <Link href={name.href}>{displayName}</Link>
      )}

      <CaseFileTelerecoursTitle title={title} displayName={displayName} singleLine={isHeading} />

      <div
        className={clsx(
          isHeading ? fr.cx("fr-mt-2v") : fr.cx("fr-mt-1v"),
          footer && clsx("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1"),
        )}
      >
        <Badge as="span" noIcon className={fr.cx(statusBadgeAccentuationClassName(statusLabel))}>
          {statusLabel}
        </Badge>
        {footer}
      </div>

      <CaseFileTagList tags={tags} />
    </div>
  );
}
