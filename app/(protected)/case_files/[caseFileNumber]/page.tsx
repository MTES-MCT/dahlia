import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { CaseFileTabs } from "@/app/ui/case-file-tabs";
import { RefreshCaseFileButton } from "@/app/ui/refresh-case-file-button";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";

type Props = {
  params: Promise<{ caseFileNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Render a label/value pair inside the header card; empty values fall back to
// "—" so the two columns keep a stable, readable layout.
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fr.cx("fr-mb-2w")}>
      <span className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-0")}>{label} : </span>
      <span className={fr.cx("fr-mb-0", "fr-ml-0")}>{value || "—"}</span>
    </div>
  );
}

export default async function Page({ params, searchParams }: Props) {
  const { caseFileNumber } = await params;
  const caseFile = await fetchCaseFileDetail(decodeURIComponent(caseFileNumber));

  if (!caseFile) {
    notFound();
  }

  // Reconstruit l'URL de retour vers le tableau de bord en conservant la
  // dernière recherche de l'utilisateur (page, tri, recherche, statut),
  // transmise via les query params du lien d'origine.
  const resolvedSearchParams = await searchParams;
  const backParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") backParams.set(key, value);
  }
  const backQueryString = backParams.toString();
  const backHref = `/case_files${backQueryString ? `?${backQueryString}` : ""}`;

  return (
    <>
      <Breadcrumb
        currentPageLabel={caseFile.caseFileNumber + (caseFile.title ? ` - ${caseFile.title}` : "")}
        segments={[
          {
            label: (
              <span className={fr.cx("fr-icon-arrow-go-back-line", "fr-link--icon-left")}>
                Tableau de bord
              </span>
            ),
            linkProps: {
              href: backHref,
            },
          },
        ]}
      />

      <section
        className={fr.cx("fr-p-3w", "fr-mb-3w")}
        style={{
          position: "relative",
          border: "1px solid var(--border-default-grey)",
          borderRadius: "0.5rem",
          backgroundColor: "var(--background-default-grey)",
        }}
      >
        <div style={{ position: "absolute", top: "5rem", right: "1rem" }}>
          <RefreshCaseFileButton caseFile={caseFile} />
        </div>

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

      <CaseFileTabs caseFile={caseFile} />
    </>
  );
}
