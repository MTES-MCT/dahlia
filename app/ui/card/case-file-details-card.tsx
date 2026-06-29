import { fr } from "@codegouvfr/react-dsfr";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import { type CaseFileDetail } from "@/app/lib/data/case-files";

type Props = {
  caseFile: NonNullable<CaseFileDetail>;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fr.cx("fr-mb-2w")}>
      <span className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-0")}>{label} : </span>
      <span className={fr.cx("fr-mb-0", "fr-ml-0")}>{value || "—"}</span>
    </div>
  );
}

export function CaseFileDetailsCard({ caseFile }: Props) {
  return (
    <section
      className={fr.cx("fr-p-3w", "fr-mb-3w")}
      style={{
        border: "1px solid var(--border-default-grey)",
        borderRadius: "0.5rem",
        backgroundColor: "var(--background-default-grey)",
      }}
    >
      <h2 className={fr.cx("fr-h4", "fr-mb-1v")}>
        {caseFile.caseFileNumber + (caseFile.title ? ` - ${caseFile.title}` : "")}
      </h2>
      <p className={fr.cx("fr-text--lead", "fr-text--sm", "fr-mb-3w")}>
        {caseFile.lastStatus.label}
      </p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <dl className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-0")}>
          <DetailRow label="Requérant" value={getActorDisplayName(caseFile.mainClaimant)} />
          <DetailRow label="Date de réception" value={formatDateFr(caseFile.depositDate)} />
        </dl>
        <dl className={fr.cx("fr-col-12", "fr-col-md-6", "fr-mb-0")}>
          <DetailRow label="Défendeur" value={getActorDisplayName(caseFile.mainDefender)} />
          <DetailRow label="Chambre" value={caseFile.chamber?.name} />
        </dl>
      </div>
    </section>
  );
}
