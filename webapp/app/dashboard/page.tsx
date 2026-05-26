import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { prisma } from "@/app/lib/prisma";

function getActorDisplayName(actor: { firstName?: string | null; lastName?: string | null; legalPersonName?: string | null; legalEntityName?: string | null }): string {
  if (actor.legalPersonName) return actor.legalPersonName;
  if (actor.legalEntityName) return actor.legalEntityName;
  if (actor.firstName && actor.lastName) return `${actor.firstName} ${actor.lastName}`;
  if (actor.lastName) return actor.lastName;
  if (actor.firstName) return actor.firstName;
  return 'N/A';
}

export default async function Page() {
  const caseFiles = await prisma.caseFile.findMany({
    include: {
      mainClaimant: true,
      mainDefender: true,
      urgency: true,
      lastStatus: true,
    },
    orderBy: {
      caseFileNumber: 'desc',
    },
  });

  const tableData = caseFiles.map(caseFile => [
    caseFile.caseFileNumber,
    getActorDisplayName(caseFile.mainClaimant),
    getActorDisplayName(caseFile.mainDefender),
    caseFile.urgency?.description || 'N/A',
    caseFile.lastStatus.label,
  ]);

  return (
    <>
      <h1 className={fr.cx('fr-mt-3w')}>Tableau de bord</h1>

      <Table
        caption={"Nombre de dossiers par tribunal administratif : " + tableData.length}
        data={tableData}
        headers={[
          'Dossier',
          'Requérant',
          'Défendeur',
          'Urgence',
          'État'
        ]}
      />
    </>
  );
}