"use client";

import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { formatDateFr } from "@/app/lib/case-file-format";
import type { CaseFileDetail } from "@/app/lib/data/case-files";

type Props = {
  // The page calls notFound() when the case file is missing, so here it is always defined.
  caseFile: NonNullable<CaseFileDetail>;
};

type TabId = "pieces" | "historique" | "debug";

export function CaseFileTabs({ caseFile }: Props) {
  const [selectedTabId, setSelectedTabId] = useState<TabId>("pieces");

  return (
    <Tabs
      selectedTabId={selectedTabId}
      onTabChange={(tabId) => setSelectedTabId(tabId as TabId)}
      tabs={[
        { tabId: "pieces", label: "Pièces" },
        { tabId: "historique", label: "Historique" },
        { tabId: "debug", label: "Debug" },
      ]}
      className={fr.cx("fr-mb-3w")}
    >
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
