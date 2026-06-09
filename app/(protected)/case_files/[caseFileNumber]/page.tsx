import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchCaseFileDetail } from "@/app/lib/data/case-files";

type Props = {
  params: Promise<{ caseFileNumber: string }>;
};

export default async function Page({ params }: Props) {
  const { caseFileNumber } = await params;
  const caseFile = await fetchCaseFileDetail(decodeURIComponent(caseFileNumber));

  if (!caseFile) {
    notFound();
  }

  return (
    <>
      <div className={fr.cx("fr-mt-3w")}>
        <Link
          href="/case_files"
          className={fr.cx("fr-link", "fr-icon-arrow-go-back-line", "fr-link--icon-left")}
        >
          Retour au tableau de bord
        </Link>
      </div>

      <h1 className={fr.cx("fr-mt-2w", "fr-h2")}>
        Dossier {caseFile.caseFileNumber} : {caseFile.title}
      </h1>

      <pre
        className={fr.cx("fr-p-2w")}
        style={{
          overflowX: "auto",
          backgroundColor: "var(--background-alt-grey)",
          borderRadius: "0.5rem",
        }}
        hidden={false}
      >
        {JSON.stringify(caseFile, null, 2)}
      </pre>
    </>
  );
}
