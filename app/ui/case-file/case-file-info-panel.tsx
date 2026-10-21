import { Fragment } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import clsx from "clsx";
import { caseFileHref } from "@/app/lib/case-file-key";
import { formatDateFr, formatDateTimeFr, getActorDisplayName } from "@/app/lib/case-file-format";
import {
  getMainClaimantActor,
  getMainDefenderActor,
  getOtherCaseFileActors,
} from "@/app/lib/case-file-actors";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import { type RelatedCaseFileLink } from "@/app/lib/data/related-case-files";
import { CaseFileTelerecoursTitle } from "@/app/ui/case-file/case-file-telerecours-title";
import { CollapsiblePanel } from "@/app/ui/panel/collapsible-panel";
import { ExpandableText } from "@/app/ui/text/expandable-text";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
  relatedCaseFiles: RelatedCaseFileLink[];
};

type Fact = { key: string; label: string; value: string };

// "-" is what getActorDisplayName returns for a missing actor.
function actorName(actor: Parameters<typeof getActorDisplayName>[0]): string {
  const name = getActorDisplayName(actor);
  return name === "-" ? "" : name;
}

// Telerecours facts, in the order of the former "Détails du dossier" modal
// (since removed from the header).
// Empty values are dropped rather than shown as "—".
function buildFacts(caseFile: NonNullable<CaseFileDetail>): Fact[] {
  const facts: Fact[] = [
    { key: "claimant", label: "Requérant", value: actorName(getMainClaimantActor(caseFile)) },
    { key: "defender", label: "Défendeur", value: actorName(getMainDefenderActor(caseFile)) },
    { key: "deposit", label: "Déposé le", value: formatDateFr(caseFile.depositDate) },
    ...getOtherCaseFileActors(caseFile).map((link) => ({
      key: `actor-${link.actorId}`,
      label: link.quality.name,
      value: actorName(link.actor),
    })),
    { key: "chamber", label: "Chambre du TA", value: caseFile.chamber?.name ?? "" },
    {
      key: "decision-date",
      label: "Décision mise à disposition le",
      value: formatDateTimeFr(caseFile.lastDecisionReading?.readingDate),
    },
    {
      key: "decision-nature",
      label: "Nature de la décision",
      value: caseFile.lastDecisionReading?.nature ?? "",
    },
  ];
  return facts.filter((fact) => fact.value.trim() !== "");
}

const termClassName = clsx(
  fr.cx("fr-text--xs", "fr-mb-0"),
  "text-(--text-mention-grey)",
  "uppercase",
  "tracking-wide",
);

function RelatedCaseFiles({ relatedCaseFiles }: { relatedCaseFiles: RelatedCaseFileLink[] }) {
  return (
    <div className={fr.cx("fr-mt-5v")}>
      <p className={termClassName}>Dossiers liés · {relatedCaseFiles.length}</p>
      <ul
        className={clsx(
          fr.cx("fr-mt-1v", "fr-mb-0", "fr-p-0"),
          "list-none",
          "border",
          "border-solid",
          "border-(--border-default-grey)",
        )}
      >
        {relatedCaseFiles.map((related) => (
          <li
            key={related.key.caseFileNumber}
            className={clsx(
              fr.cx("fr-px-2w", "fr-py-1w", "fr-m-0"),
              "flex",
              "items-center",
              "justify-between",
              "gap-4",
              "border-0",
              "border-b",
              "last:border-b-0",
              "border-solid",
              "border-(--border-default-grey)",
              !related.accessible && "bg-(--background-alt-grey)",
            )}
          >
            {/* flex-1 + min-w-0 give the text column a bounded width, so the
                single-line Télérecours title can ellipse next to the button. */}
            <div className={clsx("min-w-0", "flex-1")}>
              {related.accessible ? (
                <>
                  {/* The display name already starts with the case file number. */}
                  <span className={fr.cx("fr-text--bold")}>
                    {related.displayName ?? related.key.caseFileNumber}
                  </span>
                  <CaseFileTelerecoursTitle
                    title={related.title}
                    displayName={related.displayName ?? related.key.caseFileNumber}
                    singleLine
                  />
                </>
              ) : (
                <>
                  <span className={fr.cx("fr-text--bold")}>{related.key.caseFileNumber}</span>
                  <p
                    className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-(--text-mention-grey)")}
                  >
                    Dossier non accessible
                  </p>
                </>
              )}
            </div>
            {related.accessible ? (
              <Button
                priority="tertiary"
                size="small"
                iconId="fr-icon-arrow-right-line"
                iconPosition="right"
                className={clsx("shrink-0")}
                linkProps={{
                  href: caseFileHref(related.key),
                  target: "_blank",
                  rel: "noopener",
                  title: `Ouvrir le dossier ${related.key.caseFileNumber} - nouvelle fenêtre`,
                }}
              >
                Ouvrir
              </Button>
            ) : (
              <Button
                priority="tertiary"
                size="small"
                iconId="fr-icon-lock-line"
                iconPosition="right"
                className={clsx("shrink-0")}
                disabled
                nativeButtonProps={{ title: "Non accessible" }}
              >
                Ouvrir
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseFileInfoPanel({ caseFile, relatedCaseFiles }: Props) {
  const facts = buildFacts(caseFile);
  const operativePart = caseFile.lastDecisionReading?.operativePart?.trim() ?? "";
  const depositDate = formatDateFr(caseFile.depositDate);
  const relatedCount = relatedCaseFiles.length;

  const summaryParts: { key: string; content: React.ReactNode }[] = [];
  if (depositDate) {
    summaryParts.push({
      key: "deposit",
      content: (
        <>
          Déposé le <b className={clsx("text-(--text-title-grey)")}>{depositDate}</b>
        </>
      ),
    });
  }
  if (relatedCount > 0) {
    summaryParts.push({
      key: "related",
      content: (
        <>
          <b className={clsx("text-(--text-title-grey)")}>{relatedCount}</b>{" "}
          {relatedCount > 1 ? "dossiers liés" : "dossier lié"}
        </>
      ),
    });
  }

  return (
    <CollapsiblePanel
      title="Informations du dossier"
      hint="Données non modifiables issues de Télérecours"
      summary={
        summaryParts.length > 0 && (
          <p className={fr.cx("fr-mb-0")}>
            {summaryParts.map((part, index) => (
              <Fragment key={part.key}>
                {index > 0 && " · "}
                <span>{part.content}</span>
              </Fragment>
            ))}
          </p>
        )
      }
    >
      {(facts.length > 0 || operativePart) && (
        <dl
          className={clsx(
            fr.cx("fr-m-0"),
            "grid",
            "grid-cols-1",
            "md:grid-cols-2",
            "lg:grid-cols-3",
            "gap-x-8",
            "gap-y-5",
          )}
        >
          {facts.map((fact) => (
            <div key={fact.key} className={clsx("flex", "min-w-0", "flex-col", "gap-1")}>
              <dt className={termClassName}>{fact.label}</dt>
              <dd className={clsx("m-0", "font-medium")}>{fact.value}</dd>
            </div>
          ))}
          {operativePart && (
            <div className={clsx("col-span-full", "flex", "min-w-0", "flex-col", "gap-1")}>
              <dt className={termClassName}>Dispositif</dt>
              <dd className={clsx("m-0")}>
                <ExpandableText text={operativePart} className={clsx("font-medium")} />
              </dd>
            </div>
          )}
        </dl>
      )}

      {relatedCount > 0 && <RelatedCaseFiles relatedCaseFiles={relatedCaseFiles} />}
    </CollapsiblePanel>
  );
}
