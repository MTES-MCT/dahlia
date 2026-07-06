import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { litigationTypeLabel, rightTypeLabel } from "@/app/lib/case-file-enums";
import { type CaseFileDetail } from "@/app/lib/data/case-files";
import { CaseFileDetailsEditor } from "@/app/ui/form/case-file-details-editor";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fr.cx("fr-mb-2w")}>
      <span
        className={fr.cx("fr-text--xs", "fr-mb-0")}
        style={{ display: "block", color: "var(--text-mention-grey)" }}
      >
        {label}
      </span>
      <span className={fr.cx("fr-text--bold", "fr-mb-0")} style={{ display: "block" }}>
        {value || "—"}
      </span>
    </div>
  );
}

export function CaseFileDetailsCard({ caseFile }: Props) {
  const litigation = litigationTypeLabel(caseFile.litigationType);
  const right = rightTypeLabel(caseFile.rightType);

  return (
    <section
      className={clsx(
        fr.cx("fr-p-1w", "fr-mb-3w"),
        "border-0 border-l-4 border-solid border-l-(--border-active-blue-france)",
      )}
    >
      <CaseFileDetailsEditor
        caseFileNumber={caseFile.caseFileNumber}
        title={caseFile.title}
        statusLabel={caseFile.lastStatus.label}
        litigationType={caseFile.litigationType}
        rightType={caseFile.rightType}
        summary={caseFile.summary}
      />

      <details className={fr.cx("fr-mt-2w")}>
        <summary
          className={clsx(fr.cx("fr-text--sm", "fr-mb-0", "fr-text--bold", "fr-link"), "cursor-pointer")}
        >
          Voir plus
        </summary>

        <div
          className={clsx(
            fr.cx("fr-mt-2w"),
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4",
          )}
        >
          <DetailRow label="Requérant" value={getActorDisplayName(caseFile.mainClaimant)} />
          <DetailRow label="Défendeur" value={getActorDisplayName(caseFile.mainDefender)} />
          <DetailRow label="Date de réception" value={formatDateFr(caseFile.depositDate)} />
          <DetailRow label="Chambre" value={caseFile.chamber?.name} />
          {litigation && <DetailRow label="Type de contentieux" value={litigation} />}
          {right && <DetailRow label="Type de droit" value={right} />}
          {caseFile.summary && (
            <div className="col-span-full">
              <DetailRow label="Raison" value={caseFile.summary} />
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
