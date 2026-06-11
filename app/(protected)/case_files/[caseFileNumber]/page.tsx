import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { CaseFileTabs } from "@/app/ui/case-file-tabs";

type Props = {
  params: Promise<{ caseFileNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

      <CaseFileTabs caseFile={caseFile} />
    </>
  );
}
