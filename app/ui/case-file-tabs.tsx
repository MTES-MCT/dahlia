"use client";

import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { formatDateFr, getActorDisplayName } from "@/app/lib/case-file-format";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

type Props = {
  // The page calls notFound() when the case file is missing, so here it is always defined.
  caseFile: NonNullable<CaseFileDetail>;
};

type TabId = "details" | "pieces" | "historique" | "debug";

// Render a label/value pair; values that are empty are still displayed as "—"
// so the details list keeps a stable, readable layout.
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fr.cx("fr-mb-2w")}>
      <dt className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-0")}>{label}</dt>
      <dd className={fr.cx("fr-mb-0", "fr-ml-0")}>{value || "—"}</dd>
    </div>
  );
}

export function CaseFileTabs({ caseFile }: Props) {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("details");

  return (
    <Tabs
      selectedTabId={selectedTabId}
      onTabChange={(tabId) => setSelectedTabId(tabId as TabId)}
      tabs={[
        { tabId: "details", label: "Détails" },
        { tabId: "pieces", label: "Pièces" },
        { tabId: "historique", label: "Historique" },
        { tabId: "debug", label: "Debug" },
      ]}
    >
      {selectedTabId === "details" && (
        <dl>
          <DetailRow label="Numéro de dossier" value={caseFile.caseFileNumber} />
          <DetailRow label="Titre" value={caseFile.title} />
          <DetailRow label="Type" value={caseFile.type} />
          <DetailRow label="Statut" value={caseFile.lastStatus.label} />
          <DetailRow label="Date du statut" value={formatDateFr(caseFile.lastStatusDate)} />
          <DetailRow label="Requérant" value={getActorDisplayName(caseFile.mainClaimant)} />
          <DetailRow label="Défendeur" value={getActorDisplayName(caseFile.mainDefender)} />
          <DetailRow label="Date de création" value={formatDateFr(caseFile.creationDate)} />
          <DetailRow label="Date de réception" value={formatDateFr(caseFile.depositDate)} />
          <DetailRow
            label="Date d'audience estimée"
            value={formatDateFr(caseFile.estimatedHearingDate)}
          />
          <DetailRow label="Chambre" value={caseFile.chamber?.name} />
          <DetailRow label="Division" value={caseFile.assignedToLegalEntityDivision.name} />
          <DetailRow label="Urgence" value={caseFile.urgency?.description} />
        </dl>
      )}

      {selectedTabId === "pieces" && (
        <Table
          caption={`${caseFile.attachedFiles.length} pièce${
            caseFile.attachedFiles.length > 1 ? "s" : ""
          }`}
          headers={["Nom", "Type", "Date", "Format"]}
          data={caseFile.attachedFiles.map((file) => [
            file.originalFileName,
            file.fileTypeLabel,
            formatDateFr(file.eventCreationDate),
            file.mimeType,
          ])}
          fixed
        />
      )}

      {selectedTabId === "historique" && (
        <Table
          caption={`${caseFile.events.length} événement${caseFile.events.length > 1 ? "s" : ""}`}
          headers={["Date", "Événement", "Commentaire", "Échéance"]}
          data={caseFile.events.map((event) => [
            formatDateFr(event.eventDate),
            event.measure.label,
            event.comment ?? "—",
            event.deadlineLabel ?? "—",
          ])}
          fixed
        />
      )}

      {selectedTabId === "debug" && (
        <pre
          className={fr.cx("fr-p-2w")}
          style={{
            overflowX: "auto",
            backgroundColor: "var(--background-alt-grey)",
            borderRadius: "0.5rem",
          }}
        >
          {JSON.stringify(caseFile, null, 2)}
        </pre>
      )}
    </Tabs>
  );
}
